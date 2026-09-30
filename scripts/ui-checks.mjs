// Fast UI checks against the production build, with no voice sessions (no API cost):
// home ladder, briefing, microphone-denied message, unknown scene, unknown replay, metrics of a
// saved replay, mobile layout, a rate-limited start, and the live room with the Voice Agent socket mocked.
//
//   npm run build && node scripts/ui-checks.mjs
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 3104;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(import.meta.dirname, ".cache", "ui");
const CHROME = process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A talk saved by an older version, where AssemblyAI's utterances split the talk at a 2.5 s pause
// and the first answer at a 2 s pause. Rebuilt as turns: answers of 19 s and 17 s, two pauses.
function seededTalk() {
  const utt = (who, from, to, text) => {
    const ws = text.split(" ");
    const step = (to - from) / ws.length;
    const words = ws.map((w, i) => ({ text: w, start: Math.round(from + i * step), end: i === ws.length - 1 ? to : Math.round(from + (i + 1) * step - 80) }));
    return { who, start: from, end: to, text, words };
  };
  const talk = "Okay so the best advice I ever ignored was to start saving early because I thought I had plenty of time and it turns out I did not";
  const utterances = [
    utt("them", 500, 5000, "Hi, welcome up. I'm Priya, I'll be your host. Okay, your topic is: the best advice you've ever ignored."),
    utt("you", 6000, 30000, talk),
    utt("you", 32500, 60000, talk),
    utt("them", 62000, 70000, "Thank you. What would you tell someone starting their first job?"),
    utt("you", 71000, 80000, "I would tell them to automate it, so a little goes to savings"),
    utt("you", 82000, 90000, "before they ever see the money, because willpower runs out."),
    utt("them", 92000, 100000, "Last question: what advice are you ignoring right now?"),
    utt("you", 101000, 118000, "Probably to get more sleep. Everyone tells me, and I keep saying I will start next week."),
    utt("them", 120000, 125000, "Thank you, that was great."),
  ];
  const metrics = { youSeconds: 94, themSeconds: 26, talkShare: 0.78, avgGap: 1, longestGap: 1, wpm: 150, fillers: 0, fillersPerMin: 0, fillerWords: {}, tics: {}, questions: 0, longestTurn: 27.5, pauses: 0, longestPause: 0.1, overlaps: 0 };
  return {
    id: "sseeded",
    sceneId: "stage",
    personaName: "Priya",
    createdAt: Date.now(),
    durationSec: 126,
    sessionId: null,
    outcome: "wrapped-up",
    lines: [],
    points: [
      { t: 10, value: 62, delta: 2, signals: [], said: "", kind: "tick" },
      { t: 20, value: 66, delta: 4, signals: [], said: "", kind: "tick" },
      // scored when the host replied, 2.5 s after the answer that began at 1:11 ended
      { t: 92.5, value: 68, delta: 2, signals: [], said: "I would tell them to automate it" },
    ],
    startWarmth: 60,
    finalWarmth: 70,
    goals: {},
    topic: "The best advice you've ever ignored",
    talkSeconds: 54,
    qaStartedAt: 61,
    analysis: { transcriptId: "seeded", utterances, metrics },
    coach: { source: "llm", model: "seeded", headline: "A seeded replay", strengths: [], improvements: [], moments: [], nextStep: "Try again." },
  };
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

try {
  await mkdir(OUT, { recursive: true });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await sleep(300);
  }
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  const scenes = await page.locator(".scene").count();
  check("home lists all 7 scenes on the ladder", scenes === 7, `${scenes} scenes`);
  check("home has 5 rungs", (await page.locator(".rung").count()) === 5);
  check("home leaves out the practice list until there is some", (await page.locator("#history").count()) === 0);

  await page.goto(`${BASE}/practice/first-date`, { waitUntil: "networkidle" });
  check("first date offers a choice of two dates", (await page.locator(".choice__opt").count()) === 2);
  check("Theo is the date by default", (await page.textContent(".brief__panel h2"))?.includes("Theo") ?? false);
  await page.locator(".choice__opt").nth(1).click();
  check("choosing Nina updates the start panel", (await page.textContent(".brief__panel h2"))?.includes("Nina") ?? false);

  // microphone blocked
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.goto(`${BASE}/practice/cafe`, { waitUntil: "networkidle" });
  check("level 1 scene shows hints by default", await page.locator(".toggle input").isChecked());
  await page.getByRole("button", { name: "Start talking" }).click();
  await page.waitForSelector(".notice", { timeout: 10000 }).catch(() => {});
  const notice = (await page.textContent(".notice").catch(() => "")) ?? "";
  check("blocked microphone shows how to fix it", /Microphone access is blocked/.test(notice), notice.slice(0, 60));
  check("start button is usable again after the error", await page.getByRole("button", { name: "Start talking" }).isEnabled());

  const res = await page.goto(`${BASE}/practice/nope`);
  check("unknown scene returns 404", res?.status() === 404);
  check("404 page offers a way back", (await page.getByRole("link", { name: "Choose a scene" }).count()) === 1);

  await page.goto(`${BASE}/report/does-not-exist`, { waitUntil: "networkidle" });
  check("unknown replay explains itself", (await page.textContent("h1"))?.includes("isn’t on this device") ?? false);

  await page.evaluate((rec) => localStorage.setItem("warmup.sessions.v1", JSON.stringify([rec])), seededTalk());
  await page.goto(`${BASE}/report/sseeded`, { waitUntil: "networkidle" });
  await page.waitForSelector(".tile", { timeout: 10000 }).catch(() => {});
  const tile = (label) =>
    page.evaluate((l) => [...document.querySelectorAll(".tile")].find((t) => t.querySelector(".tile__label")?.textContent === l)?.innerText.replace(/\s+/g, " ") ?? "", label);
  const qa = await tile("Average Q&A answer");
  check("Q&A answers are measured whole, across pauses", /18 ?sec/.test(qa) && /Well sized/.test(qa), qa.slice(0, 60));
  const pause = await tile("Longest pause");
  check("pauses where AssemblyAI split an utterance still count", /2\.5 ?sec/.test(pause) && /2 pauses/.test(pause), pause.slice(0, 70));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("warmup.sessions.v1") ?? "[]")[0]?.analysis);
  check("the rebuilt analysis is saved", saved?.v === 2 && saved.utterances.filter((u) => u.who === "you").length === 3, `v=${saved?.v}`);
  const turnAt = (await page.textContent(".turn .turn__time").catch(() => "")) ?? "";
  check("a turn plays from where you started it, not from when it was scored", turnAt === "1:11", turnAt);
  check("the report folds the full transcript away", await page.evaluate(() => document.querySelector(".script-block")?.open === false));
  check("the report credits AssemblyAI once, at the end", /Universal-3\.5 Pro/.test((await page.textContent(".report__credit").catch(() => "")) ?? ""));
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("home lists a finished session", (await page.locator(".history__item").count()) === 1);
  await page.evaluate(() => localStorage.removeItem("warmup.sessions.v1"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("home has no horizontal scroll on a phone", overflow <= 0, `${overflow}px`);
  await page.goto(`${BASE}/practice/party`, { waitUntil: "networkidle" });
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("briefing has no horizontal scroll on a phone", overflow2 <= 0, `${overflow2}px`);
  await page.screenshot({ path: path.join(OUT, "brief-mobile.png"), fullPage: true });

  // Vercel's firewall rate limit answers with its own page, not our JSON: the visitor still gets a sentence.
  const limited = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone"] })).newPage();
  limited.on("pageerror", (e) => errors.push(e.message));
  await limited.route("**/api/token", (r) => r.fulfill({ status: 429, contentType: "text/html", body: "<!doctype html><title>429</title><h1>Too Many Requests</h1>" }));
  await limited.goto(`${BASE}/practice/cafe`, { waitUntil: "networkidle" });
  await limited.getByRole("button", { name: "Start talking" }).click();
  await limited.waitForSelector(".notice", { timeout: 10000 }).catch(() => {});
  const limitedNotice = (await limited.textContent(".notice").catch(() => "")) ?? "";
  check("a firewall rate limit reads as a clear message", /more than the demo allows/.test(limitedNotice) && !/[<>]/.test(limitedNotice), limitedNotice.slice(0, 70));
  await limited.context().close();

  // The live room, with a mocked Voice Agent socket: Jess greets you, you follow up on what she said.
  const room = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone"] })).newPage();
  room.on("pageerror", (e) => errors.push(e.message));
  await room.route("**/api/token", (r) => r.fulfill({ json: { token: "mock" } }));
  let agent;
  await room.routeWebSocket(/agents\.assemblyai\.com/, (ws) => {
    agent = ws;
    let ready = false;
    ws.onMessage((m) => {
      if (JSON.parse(m).type !== "session.update" || ready) return;
      ready = true;
      ws.send(JSON.stringify({ type: "session.ready", session_id: "mock" }));
    });
  });
  const send = (ev) => agent.send(JSON.stringify(ev));
  const reply = (text) => {
    send({ type: "reply.started" });
    send({ type: "reply.audio", data: Buffer.alloc(24000).toString("base64") }); // 0.5 s of silence
    send({ type: "transcript.agent", text });
    send({ type: "reply.done", status: "completed" });
  };
  await room.goto(`${BASE}/practice/cafe`, { waitUntil: "networkidle" });
  await room.getByRole("button", { name: "Start talking" }).click();
  const gauge = room.locator(".orb [role=meter]");
  await gauge.waitFor({ timeout: 10000 }).catch(() => {});
  check("the room shows Jess's interest as a gauge on her portrait", (await gauge.getAttribute("aria-label").catch(() => null)) === "Jess's interest");
  reply("Hi! Busy morning. I just got back from a climbing trip, so I'm running on coffee.");
  await room.waitForTimeout(1500);
  const before = Number(await gauge.getAttribute("aria-valuenow").catch(() => NaN));
  send({ type: "input.speech.started" });
  send({ type: "transcript.user", item_id: "u1", text: "No way, climbing? Where did you go? I've always wanted to try bouldering." });
  send({ type: "input.speech.stopped" });
  await room.waitForTimeout(300);
  reply("Fontainebleau! You should totally try it.");
  await room.waitForFunction((b) => Number(document.querySelector(".orb [role=meter]")?.getAttribute("aria-valuenow")) > b, before, { timeout: 5000 }).catch(() => {});
  const after = Number(await gauge.getAttribute("aria-valuenow").catch(() => NaN));
  const why = (await room.textContent(".stage .feed").catch(() => "")) ?? "";
  check("a follow-up moves the gauge up and says why", after > before && /Followed up/.test(why), `${before} → ${after}, ${why.slice(0, 50)}`);
  await room.screenshot({ path: path.join(OUT, "room.png") });
  await room.context().close();

  check("no uncaught page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await browser.close();
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
