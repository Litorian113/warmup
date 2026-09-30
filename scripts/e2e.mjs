// End-to-end test in a real (headless) Chromium against the production build, with a real
// Voice Agent session. getUserMedia is replaced by a controllable stream: the test "speaks"
// each TTS line only when the app says it's the user's turn, so the conversation is
// interactive and repeatable. Saves screenshots to scripts/.cache/e2e/.
//
//   npm run build && node --env-file=.env scripts/e2e.mjs [party|cafe|stage|...] [--headed] [--echo]
//
// --echo simulates a phone on speaker: everything the page plays leaks back into the fake mic.
// The fake mic bypasses the browser's echo canceller, so this checks the app's own echo guard.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { CACHE, sleep, tts, wav } from "./lib.mjs";

const PLAN = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "party";
const HEADED = process.argv.includes("--headed");
const MOBILE = process.argv.includes("--mobile"); // run the live session at phone size
const ECHO = process.argv.includes("--echo"); // the persona's voice leaks back into the mic
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(CACHE, "e2e");
const CHROME = process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`;

const LINES = {
  cafe: ["Hi! Um, can I get a flat white, please?", "It's Alex. Uh, yeah, busy day. I have a job interview this afternoon, so I really need the caffeine.", "Thanks. Do you, um, like working here?", "Oh nice, Japan! That sounds amazing. Thanks so much, have a good one!"],
  party: [
    "Um, hi. Yeah, I, uh, work with Maya. I'm Alex, by the way. What's your name?",
    "Nice to meet you, Sam. So how do you know Maya?",
    "Oh, climbing! I've always wanted to try that. Is it scary at first?",
    "Ha, that makes sense. I actually do a bit of hiking too. Where did you go on your last trip?",
    "Well, it was really nice meeting you, Sam. I'm gonna grab a drink. Catch you later.",
  ],
  coworker: [
    "Ha, I think it's just slow on Mondays. How was your weekend?",
    "Oh no, moving is the worst. Mine was quiet. I went on a long bike ride and, um, finally fixed my brakes.",
    "Wait, you play football? Me too, I used to play every week. Where do you play?",
    "Nice. Well, good luck with the meeting. Have a good one!",
  ],
  // with Theo, the default date
  "first-date": [
    "Ha, no, it's me. Hi! Um, did you find the place okay?",
    "So you're a chef, right? What's the most chaotic night you've had in the kitchen?",
    "No way. I actually tried to learn to surf last summer, and I spent most of it falling off the board.",
    "Wait, you surf too? How bad are we talking?",
  ],
  // a warm conversation, then the ask: Lena should say yes
  "ask-out": [
    "Ha, no, I haven't. What's so funny about it?",
    "I love a good mystery. Have you guessed the killer yet?",
    "Me too, I always try to guess. I also love old films. Have you seen Knives Out?",
    "This has been really fun. Would you like to grab a coffee with me sometime this week?",
    "Great! It was really nice meeting you. See you soon!",
  ],
  // one-word answers: Daniel should lose interest and walk away
  cold: { scene: "networking", lines: ["Hi.", "Yeah.", "Okay.", "Sure.", "Fine.", "Yep."] },
  networking: ["Hi. Um, are you enjoying the event?", "Cool. What do you work on?", "Shipping ports? That's, uh, actually really interesting. What's the hardest part of that job?", "Wow. Hey, it was great talking. Can I add you on LinkedIn?"],
  stage: {
    talk: [
      "Okay. So, um, the most underrated invention of all time. I'm going to say, uh, the humble shipping container.",
      "Before containers, loading a ship took weeks. Dock workers moved every sack and barrel by hand, and, um, a lot of cargo got stolen or broken.",
      "Then in the nineteen fifties someone decided to put everything in the same standard steel box. And that one boring idea made global trade, like, ridiculously cheap.",
      "It's the reason your phone, your shoes, and your bananas can come from three different continents.",
      "And it's not just trade. Old containers get turned into cafes, homes, even swimming pools, because they're cheap, strong, and they stack like Lego.",
      "So my point is this: the best inventions are often the boring ones nobody notices. Next time you see a container on a truck, give it a little nod.",
    ],
    answers: [
      "Good question. I think, um, the downside is that it made it really easy to move factories to wherever labor is cheapest, which hurt a lot of towns.",
      "Honestly I'd pick the bicycle as my runner-up, because it's still the most efficient way to move a person.",
    ],
  },
};

// a plan can target a different scene: { scene, lines }
const SCENE = LINES[PLAN]?.scene ?? PLAN;

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("server did not start");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // Run next directly in its own process group so the whole server dies with the test.
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    detached: true,
  });
  server.stdout.on("data", (d) => process.env.VERBOSE && process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stdout.write(`[server:err] ${d}`));
  const errors = [];
  let browser;
  try {
    await waitForServer();
    log(`server up at ${BASE}; scene=${SCENE}`);

    // pre-generate the user's lines (cached after the first run)
    const plan = LINES[PLAN].lines ?? LINES[PLAN];
    const toClip = async (text) => ({ text, b64: wav(await tts(text, "michael")).toString("base64") });
    const talkClips = plan.talk ? await Promise.all(plan.talk.map(toClip)) : [];
    const clips = await Promise.all((plan.answers ?? plan).map(toClip));

    browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED, args: ["--autoplay-policy=no-user-gesture-required"] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(
      ({ echo }) => {
        let ctx, dest;
        const ensure = () => {
          if (!ctx) {
            ctx = new AudioContext();
            dest = ctx.createMediaStreamDestination();
          }
          return { ctx, dest };
        };
        // like a real mic, every call gets its own track (the app stops its tracks when a session ends)
        navigator.mediaDevices.getUserMedia = async () => new MediaStream(ensure().dest.stream.getAudioTracks().map((t) => t.clone()));
        if (echo) {
          // Speaker-to-mic leak: whatever the page plays reaches the mic 120 ms later at about -9 dB,
          // whether it plays through an <audio> element or straight out of a Web Audio graph.
          const leak = (stream) => {
            const { ctx, dest } = ensure();
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.12;
            const gain = ctx.createGain();
            gain.gain.value = 0.35;
            ctx.createMediaStreamSource(stream).connect(delay).connect(gain).connect(dest);
          };
          const play = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            if (this.srcObject instanceof MediaStream) leak(this.srcObject);
            return play.call(this);
          };
          const connect = AudioNode.prototype.connect;
          const taps = new WeakMap();
          AudioNode.prototype.connect = function (target, ...rest) {
            if (target instanceof AudioDestinationNode && target.context !== ctx) {
              let tap = taps.get(target.context);
              if (!tap) {
                tap = target.context.createMediaStreamDestination();
                taps.set(target.context, tap);
                leak(tap.stream);
              }
              connect.call(this, tap);
            }
            return connect.call(this, target, ...rest);
          };
        }
        // The app plays the persona through a WebRTC connection inside the page. Keep that
        // connection's receive stats: concealed audio is what a listener hears as crackles.
        const NativePC = window.RTCPeerConnection;
        if (NativePC) {
          window.__rtc = { pcs: [], last: {} };
          window.RTCPeerConnection = class extends NativePC {
            constructor(...args) {
              super(...args);
              window.__rtc.pcs.push(this);
            }
          };
          setInterval(() => {
            window.__rtc.pcs.forEach((pc, i) => {
              if (pc.signalingState === "closed") return;
              pc.getStats()
                .then((stats) =>
                  stats.forEach((s) => {
                    if (s.type === "inbound-rtp" && s.kind === "audio") window.__rtc.last[i] = { ...s };
                  }),
                )
                .catch(() => {});
            });
          }, 500);
        }
        window.__statusLog = [];
        window.__audioLog = [];
        new MutationObserver(() => {
          const s = document.querySelector(".status-line")?.textContent ?? "";
          const last = window.__statusLog[window.__statusLog.length - 1];
          if (!last || last.s !== s) window.__statusLog.push({ at: Date.now(), s });
          const room = document.querySelector(".room");
          const a = room ? `output=${room.dataset.output ?? "?"} echo=${room.dataset.echo ?? "?"}` : null;
          if (a && window.__audioLog[window.__audioLog.length - 1] !== a) window.__audioLog.push(a);
        }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-echo", "data-output"] });
        window.__fakeMic = {
          async say(b64) {
            const { ctx, dest } = ensure();
            await ctx.resume();
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const buf = await ctx.decodeAudioData(bytes.buffer);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(dest);
            src.start();
            await new Promise((r) => (src.onended = r));
            return buf.duration;
          },
        };
      },
      { echo: ECHO },
    );

    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
    const wsEvents = {};
    const wsLog = []; // recent non-audio frames, for diagnosing stalls
    const turn = { saidAt: 0, firstAudioAt: 0 }; // agent latency: end of our line -> first reply audio
    const marks = [];
    const timeline = []; // every frame (audio as byte counts), for offline analysis
    const T0 = Date.now();
    page.on("websocket", (ws) => {
      if (!ws.url().includes("agents.assemblyai.com")) return;
      const note = (dir, payload) => {
        try {
          const ev = JSON.parse(payload);
          if (dir === "in") wsEvents[ev.type] = (wsEvents[ev.type] ?? 0) + 1;
          if (ev.type === "reply.done" && ev.status === "interrupted") wsEvents["reply.done(interrupted)"] = (wsEvents["reply.done(interrupted)"] ?? 0) + 1;
          timeline.push({ t: Date.now() - T0, dir, type: ev.type, ...(ev.type === "reply.audio" ? { bytes: ev.data.length } : ev.type === "input.audio" ? {} : { ev: { ...ev, audio: undefined, data: undefined } }) });
          if (ev.type === "reply.audio" && turn.saidAt && !turn.firstAudioAt) turn.firstAudioAt = Date.now();
          if (ev.type === "input.audio" || ev.type === "reply.audio" || ev.type?.endsWith(".delta")) return;
          wsLog.push(`${new Date().toISOString().slice(14, 23)} ${dir} ${ev.type} ${JSON.stringify(ev.text ?? ev.status ?? ev.code ?? ev.instructions ?? (ev.session ? Object.keys(ev.session).join(",") : "")).slice(0, 90)}`);
          if (wsLog.length > 60) wsLog.shift();
        } catch {}
      };
      ws.on("framereceived", ({ payload }) => note("in", payload));
      ws.on("framesent", ({ payload }) => note("out", payload));
    });
    globalThis.__diagnose = async () => {
      await page.screenshot({ path: path.join(OUT, `fail-${SCENE}.png`) }).catch(() => {});
      const ui = await page.evaluate(() => ({
        status: document.querySelector(".status-line")?.textContent,
        mood: document.querySelector(".stage__mood")?.textContent,
        them: document.querySelector(".caption--them")?.textContent,
        you: document.querySelector(".caption--you")?.textContent,
      })).catch((e) => String(e));
      console.log("UI:", JSON.stringify(ui));
      console.log("WS LOG:\n  " + wsLog.join("\n  "));
    };

    // Home (desktop + mobile) and briefing screenshots
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "home-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(OUT, "home-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    if (MOBILE) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/practice/${SCENE}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, `brief-${SCENE}.png`), fullPage: true });
    await page.getByRole("button", { name: "Start talking" }).click();
    await page.waitForSelector(".room", { timeout: 20000 });
    log("session live");
    const scrolled = await page.waitForFunction(() => scrollY === 0, null, { timeout: 2000 }).then(() => 0, () => page.evaluate(() => scrollY));
    if (scrolled > 0) console.log(`  FAIL: the room opened scrolled down by ${scrolled}px, with its top bar out of view`);

    const say = async (clip) => {
      log(`YOU: ${clip.text}`);
      await page.evaluate((b64) => window.__fakeMic.say(b64), clip.b64);
      turn.saidAt = Date.now();
      marks.push({ t: turn.saidAt - T0, said: clip.text });
      turn.firstAudioAt = 0;
      turn.logFrom = wsLog.length;
      // wait until the app has registered the turn, so "Your turn" below means the next one
      await page
        .waitForFunction(() => !/Your turn/.test(document.querySelector(".status-line")?.textContent ?? ""), null, { timeout: 6000, polling: 200 })
        .catch(() => {});
    };
    const yourTurn = () =>
      page.waitForFunction(() => /Your turn/.test(document.querySelector(".status-line")?.textContent ?? ""), null, { timeout: 45000, polling: 200 });
    const lastThem = async () => {
      if (turn.saidAt && turn.firstAudioAt) {
        const s = (turn.firstAudioAt - turn.saidAt) / 1000;
        log(`agent latency ${s.toFixed(1)}s`);
        if (s > 5) console.log("  slow turn, events since our line:\n    " + wsLog.slice(Math.max(0, turn.logFrom - 2)).join("\n    "));
      }
      return page.evaluate(() => document.querySelector(".caption--them")?.textContent ?? "");
    };

    if (plan.talk) {
      await page.waitForSelector(".topic", { timeout: 30000 });
      log(`topic: ${await page.textContent(".topic")}`);
      await sleep(800);
      for (const c of talkClips) {
        await say(c);
        await sleep(600);
      }
      await page.screenshot({ path: path.join(OUT, `live-${SCENE}-talk.png`) });
      await sleep(1500);
      await page.getByRole("button", { name: /I.m done/ }).click();
      log("talk finished, Q&A");
    }

    for (let i = 0; i < clips.length; i++) {
      if (page.url().includes("/report/")) break;
      await Promise.race([yourTurn(), page.waitForURL(/\/report\//, { timeout: 45000 })]);
      if (page.url().includes("/report/")) break;
      log(`THEM: ${await lastThem()}`);
      await sleep(700);
      await say(clips[i]);
      if (i === 1) {
        await sleep(2500);
        await page.screenshot({ path: path.join(OUT, `live-${SCENE}${MOBILE ? "-mobile" : ""}.png`), fullPage: MOBILE });
        const hint = (await page.locator(".tip").count()) ? await page.textContent(".tip") : null;
        if (hint) log(`hint shown: ${hint}`);
      }
    }

    // The farewell (or final answer) should end the session by itself; otherwise end it.
    try {
      await page.waitForURL(/\/report\//, { timeout: 25000 });
      log("session ended by itself");
    } catch {
      log("no auto-end; clicking End");
      await page.getByRole("button", { name: /^End/ }).click();
      await page.waitForURL(/\/report\//, { timeout: 20000 });
    }
    const reportUrl = page.url();
    log(`report: ${reportUrl}`);
    await page.waitForSelector(".tile", { timeout: 120000 });
    log("metrics ready");
    await page.waitForSelector(".note", { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector(".report .spinner"), null, { timeout: 120000 }).catch(() => {});
    await sleep(1000);
    const summary = await page.evaluate(() => ({
      headline: document.querySelector(".report__headline")?.textContent,
      outcome: document.querySelector(".report__outcome")?.textContent,
      coachSource: document.querySelector(".report__credit")?.textContent,
      tiles: [...document.querySelectorAll(".tile")].map((t) => t.innerText.replace(/\n+/g, " | ")),
      goals: [...document.querySelectorAll(".report .goal")].map((g) => `${g.classList.contains("is-done") ? "✓" : "○"} ${g.textContent}`),
    }));
    console.log(JSON.stringify(summary, null, 2));
    await page.screenshot({ path: path.join(OUT, `report-${SCENE}.png`), fullPage: true });

    // Retake: replay the first moment the coach flagged and answer it differently.
    if (process.argv.includes("--retake")) {
      const link = page.getByRole("link", { name: "Try this moment again" }).first();
      if (await link.count()) {
        await link.click();
        await page.waitForSelector("text=Try this moment again", { timeout: 15000 });
        await page.screenshot({ path: path.join(OUT, `retake-brief-${SCENE}.png`), fullPage: true });
        await page.getByRole("button", { name: "Start the retake" }).click();
        await page.waitForSelector(".room", { timeout: 20000 });
        await yourTurn();
        log(`THEM (retake): ${await lastThem()}`);
        await sleep(600);
        await say(await toClip("Oh nice! Wait, what got you into that in the first place?"));
        await page.waitForURL(/\/report\/.*#moment-/, { timeout: 45000 });
        await page.waitForSelector(".retake__result", { timeout: 20000 });
        log(`retake result: ${(await page.textContent(".retake__result"))?.replace(/\s+/g, " ")}`);
        await sleep(800);
        log(`scrolled to the moment: ${(await page.evaluate(() => scrollY)) > 0}`);
        await page.screenshot({ path: path.join(OUT, `retake-result-${SCENE}.png`) });
      } else log("no retake-able moment in this report");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(OUT, `report-${SCENE}-mobile.png`), fullPage: true });
    log(`ws events: ${JSON.stringify(wsEvents)}`);
    log(`audio route: ${(await page.evaluate(() => window.__audioLog ?? []).catch(() => [])).join(" -> ") || "(not reported)"}${ECHO ? " [simulated speaker echo]" : ""}`);
    for (const r of Object.values(await page.evaluate(() => window.__rtc?.last ?? {}).catch(() => ({})))) {
      const rate = r.totalSamplesReceived / Math.max(0.001, r.totalSamplesDuration || 1);
      const ms = (n) => Math.round((1000 * (n ?? 0)) / (rate || 48000));
      log(
        `call audio: ${(r.totalSamplesDuration ?? 0).toFixed(1)}s received, concealed ${ms(r.concealedSamples)} ms in ${r.concealmentEvents ?? 0} events` +
          ` (${ms(r.concealedSamples - (r.silentConcealedSamples ?? 0))} ms not silent), stretched +${ms(r.insertedSamplesForDeceleration)}/-${ms(r.removedSamplesForAcceleration)} ms,` +
          ` jitter buffer ${r.jitterBufferEmittedCount ? Math.round((1000 * r.jitterBufferDelay) / r.jitterBufferEmittedCount) : "?"} ms, lost ${r.packetsLost ?? 0}/${r.packetsReceived ?? 0} packets,` +
          ` ${Math.round((8 * (r.bytesReceived ?? 0)) / Math.max(1, r.totalSamplesDuration ?? 1) / 1000)} kbit/s`,
      );
    }
    const statusLog = await page.evaluate(() => window.__statusLog ?? []).catch(() => []);
    await writeFile(path.join(OUT, `timeline-${SCENE}.json`), JSON.stringify({ T0, timeline, statusLog, marks }, null, 1));
    // the saved session, so `npm run ui-checks` can render a real report without a new voice session
    const saved = await page.evaluate(() => localStorage.getItem("warmup.sessions.v1")).catch(() => null);
    if (saved) await writeFile(path.join(OUT, `record-${SCENE}.json`), JSON.stringify(JSON.parse(saved)[0], null, 1));
  } catch (e) {
    console.error(e.message);
    await globalThis.__diagnose?.();
    throw e;
  } finally {
    if (errors.length) console.log("BROWSER ERRORS:\n" + errors.join("\n"));
    await browser?.close();
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
