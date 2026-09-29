// Estimates each English voice's median pitch (F0) so persona genders match their voices.
//   node --env-file=.env scripts/voice-pitch.mjs
import { tts, RATE } from "./lib.mjs";

function medianF0(pcm) {
  const frame = Math.round(RATE * 0.04), hop = Math.round(RATE * 0.02);
  const minLag = Math.floor(RATE / 400), maxLag = Math.ceil(RATE / 70);
  const f0s = [];
  for (let s = 0; s + frame + maxLag < pcm.length; s += hop) {
    let energy = 0;
    for (let i = 0; i < frame; i++) energy += pcm[s + i] ** 2;
    if (Math.sqrt(energy / frame) < 1500) continue; // skip quiet frames
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < frame; i++) {
        const a = pcm[s + i], b = pcm[s + i + lag];
        num += a * b; e1 += a * a; e2 += b * b;
      }
      const r = num / Math.sqrt(e1 * e2 + 1);
      if (r > best) best = r, bestLag = lag;
    }
    if (best > 0.6) f0s.push(RATE / bestLag);
  }
  f0s.sort((a, b) => a - b);
  return { f0: Math.round(f0s[Math.floor(f0s.length / 2)] ?? 0), frames: f0s.length };
}

const voices = ["alba", "eve", "george", "jane", "jean", "mary", "michael", "anna", "charles", "paul", "vera"];
for (const v of voices) {
  const pcm = await tts("Hi there, it's really nice to meet you. How has your day been so far?", v);
  const { f0, frames } = medianF0(pcm);
  console.log(`${v.padEnd(8)} median F0 ≈ ${String(f0).padStart(3)} Hz  (${frames} voiced frames) → ${f0 < 160 ? "lower (male-range)" : "higher (female-range)"}`);
}
