// Post-session pipeline test: wait for the session's artifacts, then transcribe the stereo
// recording (left = user, right = agent) with multichannel + disfluencies.
//
//   node --env-file=.env scripts/analyze.mjs <session_id>
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { KEY, CACHE, sleep, uploadAudio, transcribe } from "./lib.mjs";

const sessionId = process.argv[2];
if (!sessionId) throw new Error("usage: analyze.mjs <session_id>");

const t0 = performance.now();
const since = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

let session;
for (;;) {
  session = await (await fetch(`https://agents.assemblyai.com/v1/sessions/${sessionId}`, { headers: { Authorization: KEY } })).json();
  if (session.artifacts?.length) break;
  if (performance.now() - t0 > 120000) throw new Error("artifacts not ready after 120s: " + JSON.stringify(session).slice(0, 300));
  await sleep(1000);
}
console.log(`artifacts ready after ${since()} (status=${session.status}, duration=${session.duration_seconds}s)`);

const url = (type) => session.artifacts.find((a) => a.type === type)?.url;
const [audio, timeline, meta] = await Promise.all([
  fetch(url("audio")).then((r) => r.arrayBuffer()),
  fetch(url("timeline")).then((r) => r.json()),
  fetch(url("metadata")).then((r) => r.json()),
]);
await writeFile(path.join(CACHE, `${sessionId}.ogg`), Buffer.from(audio));
await writeFile(path.join(CACHE, `${sessionId}.timeline.json`), JSON.stringify(timeline, null, 2));
console.log(`audio ${(audio.byteLength / 1024).toFixed(0)} KiB, metadata: ${JSON.stringify(meta)}`);
console.log(`timeline started_at_unix_ms=${timeline.started_at_unix_ms}, turns=${timeline.turns?.length}`);
for (const t of timeline.turns ?? []) console.log(`  [${t.trigger}] ${t.status} ttfa=${t.time_to_first_audio_ms}ms user=${JSON.stringify(t.user_transcript)} agent=${JSON.stringify(t.agent_text)}`);

const t1 = performance.now();
const uploadUrl = await uploadAudio(Buffer.from(audio));
const tr = await transcribe({
  audio_url: uploadUrl,
  speech_models: ["universal-3-5-pro", "universal-2"],
  multichannel: true,
  disfluencies: true,
});
console.log(`\ntranscribed in ${((performance.now() - t1) / 1000).toFixed(1)}s, model=${tr.speech_model_used ?? tr.speech_model}, channels=${tr.audio_channels}, audio_duration=${tr.audio_duration}`);
await writeFile(path.join(CACHE, `${sessionId}.transcript.json`), JSON.stringify(tr, null, 2));

for (const u of tr.utterances ?? []) {
  console.log(`  ch${u.channel ?? u.speaker} ${(u.start / 1000).toFixed(2)}–${(u.end / 1000).toFixed(2)}s: ${u.text}`);
}
const FILLERS = /^(um+|uh+|er+|ah+|hmm+|mm+|uh-huh|erm)$/i;
const userWords = (tr.words ?? []).filter((w) => String(w.channel) === "1");
const fillers = userWords.filter((w) => FILLERS.test(w.text.replace(/[^\w-]/g, "")));
console.log(`\nuser words=${userWords.length}, fillers=${fillers.length}: ${fillers.map((w) => `${w.text}@${(w.start / 1000).toFixed(1)}s`).join(", ")}`);
console.log(`sample word: ${JSON.stringify(userWords[0])}`);
