// Scripted "user" (TTS lines) talks to a persona in real time over the Voice Agent API.
// Streams audio at exactly real-time pace, simulates agent playback timing, and reports
// per-turn latency measured from the moment the user finished speaking.
//
//   node --env-file=.env scripts/simulate.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openAgent, tts, decodePcm, RATE, CACHE, sleep } from "./lib.mjs";

const PERSONA = {
  system_prompt: `You are Sam, 29, at a friend's house party on a Saturday night. You are a real person, not an assistant. Someone you don't know just started talking to you by the snack table.

MOST IMPORTANT: talk like a real person at a party. One or two short sentences, usually under 20 words. Never lecture, never coach, never ask more than one question at a time.

Who you are: you edit podcasts for a living. You moved here a year ago from Portland. You have an anxious rescue dog named Pixel. You just got back from a hiking trip. You know the host, Maya, from the climbing gym.

How you behave: you don't carry the conversation. Answer what you're asked and sometimes add one small detail they could pick up on. Match their energy: flat answers get short answers, curiosity gets warmth. Reveal the interesting details only when they ask about you. If it stalls, get a bit bored and look for a polite way out.

Never say "great question", "that's so interesting", or "I'd be happy to". No exclamation marks, no lists, no emojis.`,
  greeting: "Hey. These chips are dangerously good. Do you know Maya from work or something?",
  output: { voice: "jane" },
};

const USER_VOICE = "michael";
const USER_LINES = [
  "Um, yeah, hi. I, uh, I actually work with Maya. I'm Alex.",
  "Nice. So, what do you do?",
  "Oh, that's cool. How did you, um, get into that?",
  "Nice. I've been, like, thinking about starting a podcast actually.",
  "Anyway, it was really nice meeting you, Sam. I'm gonna go grab a drink.",
];
const THINK_MS = 900; // pause before the user starts answering

// ---------- generate user audio ----------
console.log("Generating user TTS lines…");
const linePcm = [];
for (const line of USER_LINES) linePcm.push(await tts(line, USER_VOICE));
console.log(linePcm.map((p, i) => `  line ${i + 1}: ${(p.length / RATE).toFixed(1)}s`).join("\n"));

// ---------- session ----------
const log = [];
const waiters = new Set();
let playEnd = 0; // ms (session clock) when simulated agent playback finishes
const firstAudioSeen = new Set();

function onEvent(ev, t) {
  if (ev.type === "reply.audio") {
    const pcm = decodePcm(ev.data);
    playEnd = Math.max(playEnd, t) + (pcm.length / RATE) * 1000;
    const id = ev.reply_id ?? "cur";
    if (!firstAudioSeen.has(id)) firstAudioSeen.add(id), log.push({ t, type: "reply.audio(first)" });
  } else if (ev.type === "transcript.user.delta" || ev.type === "transcript.agent.delta") {
    // too chatty to log individually
  } else {
    const entry = { t, type: ev.type };
    if (ev.text !== undefined) entry.text = ev.text;
    if (ev.status) entry.status = ev.status;
    if (ev.interrupted) entry.interrupted = true;
    if (ev.code) entry.code = ev.code;
    log.push(entry);
    if (ev.type === "reply.done" && ev.status === "interrupted") playEnd = t;
    if (ev.type === "reply.started") firstAudioSeen.delete("cur");
  }
  for (const w of waiters) if (w.match(ev)) waiters.delete(w), w.resolve(t);
}
const waitFor = (match, timeout = 25000) =>
  new Promise((resolve) => {
    const w = { match, resolve };
    waiters.add(w);
    setTimeout(() => waiters.delete(w) && resolve(null), timeout);
  });

const agent = await openAgent(PERSONA, onEvent);
console.log(`session ${agent.sessionId} ready at ${agent.now()}ms`);

// real-time audio pump: 50 ms chunks, never ahead of the wall clock
const CHUNK = RATE / 20;
const SILENCE = new Int16Array(CHUNK);
let speaking = null;
const pumpStart = performance.now();
let sent = 0;
const pump = setInterval(() => {
  const due = Math.floor(((performance.now() - pumpStart) / 1000) * RATE);
  while (sent + CHUNK <= due) {
    let chunk = SILENCE;
    if (speaking) {
      chunk = new Int16Array(CHUNK);
      chunk.set(speaking.pcm.subarray(speaking.pos, speaking.pos + CHUNK));
      speaking.pos += CHUNK;
      if (speaking.pos >= speaking.pcm.length) {
        const s = speaking;
        speaking = null;
        queueMicrotask(() => s.resolve(agent.now()));
      }
    }
    agent.sendAudio(chunk);
    sent += CHUNK;
  }
}, 20);
const speak = (pcm) => new Promise((resolve) => (speaking = { pcm, pos: 0, resolve }));
const sleepUntil = async (t) => {
  while (agent.now() < t) await sleep(Math.min(50, t - agent.now()));
};

await waitFor((e) => e.type === "reply.done"); // greeting
const turns = [];
for (let i = 0; i < USER_LINES.length; i++) {
  await sleepUntil(playEnd + THINK_MS);
  const tStart = agent.now();
  log.push({ t: tStart, type: `USER START line ${i + 1}` });
  const tEnd = await speak(linePcm[i]);
  log.push({ t: tEnd, type: `USER END line ${i + 1}` });
  const tDone = await waitFor((e) => e.type === "reply.done");
  const win = log.filter((e) => e.t >= tStart && (tDone === null || e.t <= tDone));
  const at = (type) => win.find((e) => e.type === type && e.t >= tEnd)?.t ?? null;
  const rel = (t) => (t === null ? null : t - tEnd);
  turns.push({
    line: USER_LINES[i],
    heard: win.findLast((e) => e.type === "transcript.user")?.text ?? null,
    agent: win.findLast((e) => e.type === "transcript.agent")?.text ?? null,
    early: win.some((e) => e.type === "reply.started" && e.t < tEnd),
    speechStopped: rel(at("input.speech.stopped")),
    transcriptFinal: rel(at("transcript.user")),
    replyStarted: rel(at("reply.started")),
    firstAudio: rel(at("reply.audio(first)")),
  });
}
await sleepUntil(playEnd + 400);
clearInterval(pump);
const ended = await agent.end();

// ---------- report ----------
console.log("\n=== turns (ms after the user stopped speaking) ===");
for (const [i, t] of turns.entries()) {
  console.log(`\n#${i + 1} said:  ${t.line}`);
  console.log(`   heard: ${t.heard}`);
  console.log(`   agent: ${t.agent}`);
  console.log(
    `   speech.stopped +${t.speechStopped}  transcript.user +${t.transcriptFinal}  reply.started +${t.replyStarted}  first audio +${t.firstAudio}${t.early ? "  (EARLY reply before user finished)" : ""}`,
  );
}
const fa = turns.map((t) => t.firstAudio).filter((x) => x !== null);
console.log(`\nfirst-audio latency: median ${fa.sort((a, b) => a - b)[Math.floor(fa.length / 2)]}ms, max ${Math.max(...fa)}ms`);
console.log(`session.ended: ${JSON.stringify(ended)}`);
console.log(`SESSION_ID=${agent.sessionId}`);
await mkdir(CACHE, { recursive: true });
await writeFile(path.join(CACHE, `sim-${agent.sessionId}.json`), JSON.stringify({ sessionId: agent.sessionId, turns, log }, null, 2));
