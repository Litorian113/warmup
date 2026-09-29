// Shared helpers for the API test harness. Run scripts with:
//   node --env-file=.env scripts/<script>.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const KEY = process.env.ASSEMBLY_KEY;
if (!KEY) throw new Error("ASSEMBLY_KEY missing. Run with: node --env-file=.env scripts/<script>.mjs");

export const RATE = 24000; // Voice Agent API: PCM16 mono 24 kHz
export const CACHE = path.join(import.meta.dirname, ".cache");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Voice Agent API ----------

export async function mintAgentToken({ expiresIn = 120, maxSession = 900 } = {}) {
  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", String(expiresIn));
  url.searchParams.set("max_session_duration_seconds", String(maxSession));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).token;
}

/**
 * Opens a Voice Agent session with an inline config. Resolves once session.ready arrives.
 * Every server event is passed to onEvent(event, tMs) where tMs is ms since the socket opened.
 */
export async function openAgent(session, onEvent = () => {}) {
  const token = await mintAgentToken();
  const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  let ended;
  const endedP = new Promise((r) => (ended = r));

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "session.update", session })));
    ws.addEventListener("message", (msg) => {
      const ev = JSON.parse(msg.data);
      onEvent(ev, now());
      if (ev.type === "session.ready") resolve(ev);
      if (ev.type === "session.error") console.error("  session.error:", ev.code, ev.message, ev.param ?? "");
      if (ev.type === "session.ended") ended(ev);
    });
    ws.addEventListener("close", (e) => {
      reject(new Error(`socket closed before ready (${e.code} ${e.reason})`));
      ended(null);
    });
    ws.addEventListener("error", () => {});
  });

  const readyEv = await ready;
  return {
    ws,
    now,
    sessionId: readyEv.session_id,
    config: readyEv.config,
    send: (obj) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(obj)),
    sendAudio: (int16) =>
      ws.readyState === WebSocket.OPEN &&
      ws.send(JSON.stringify({ type: "input.audio", audio: Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength).toString("base64") })),
    async end() {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "session.end" }));
      const r = await Promise.race([endedP, sleep(5000).then(() => null)]);
      ws.close();
      return r;
    },
  };
}

export const decodePcm = (b64) => {
  const buf = Buffer.from(b64, "base64");
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2).slice();
};

export function concatPcm(chunks) {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) out.set(c, o), (o += c.length);
  return out;
}

// ---------- TTS via the agent greeting ----------
// AssemblyAI has no standalone TTS API, but a session's `greeting` is sent straight to TTS.
// We open a throwaway session whose greeting is the text, capture the audio, and end it.

export async function tts(text, voice = "michael") {
  const file = path.join(CACHE, "tts", `${voice}-${createHash("sha1").update(text).digest("hex").slice(0, 12)}.wav`);
  try {
    return readWav(await readFile(file));
  } catch {}
  const chunks = [];
  let done;
  const doneP = new Promise((r) => (done = r));
  const agent = await openAgent(
    {
      system_prompt: "You are silent. Never say anything.",
      greeting: text,
      output: { voice },
    },
    (ev) => {
      if (ev.type === "reply.audio") chunks.push(decodePcm(ev.data));
      if (ev.type === "reply.done") done();
    },
  );
  await Promise.race([doneP, sleep(30000)]);
  await agent.end();
  const pcm = trimSilence(concatPcm(chunks));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, wav(pcm));
  return pcm;
}

export function trimSilence(pcm, threshold = 300) {
  let a = 0,
    b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < threshold) a++;
  while (b > a && Math.abs(pcm[b]) < threshold) b--;
  const pad = RATE * 0.05;
  return pcm.slice(Math.max(0, a - pad), Math.min(pcm.length, b + pad));
}

// ---------- WAV ----------

export function wav(pcm, rate = RATE) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.byteLength, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]);
}

export function readWav(buf) {
  const dataAt = buf.indexOf("data", 12);
  const len = buf.readUInt32LE(dataAt + 4);
  const start = dataAt + 8;
  return new Int16Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + len));
}

// ---------- Pre-recorded STT + LLM Gateway ----------

export async function uploadAudio(bytes) {
  const res = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/octet-stream" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
  return (await res.json()).upload_url;
}

export async function transcribe(params) {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const job = await res.json();
  if (!res.ok) throw new Error(`transcript ${res.status}: ${JSON.stringify(job)}`);
  for (;;) {
    await sleep(1500);
    const t = await (await fetch(`https://api.assemblyai.com/v2/transcript/${job.id}`, { headers: { authorization: KEY } })).json();
    if (t.status === "completed") return t;
    if (t.status === "error") throw new Error(`transcript error: ${t.error}`);
  }
}

export async function llm(body) {
  const res = await fetch("https://llm-gateway.assemblyai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`llm ${res.status}: ${JSON.stringify(json)}`);
  return json;
}
