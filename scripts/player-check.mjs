// Checks the playback worklet (public/worklets/player-processor.js) outside the browser, on a
// cached agent recording. Feeding the voice as 10 ms chunks that arrive while it plays, the way
// the Voice Agent API sends them, must give exactly the same audio as one long buffer: any
// difference at a chunk boundary is an audible click. Also checks peaks stay below full scale
// and that a flush fades out.
//
//   node scripts/player-check.mjs        (needs a cached voice clip: run any e2e plan once)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const CACHE = path.join(import.meta.dirname, ".cache");

const QUANTUM = 128;
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

// the loudest cached agent clip (24 kHz PCM16 WAV)
const dir = path.join(CACHE, "tts");
const clips = readdirSync(dir).filter((f) => f.endsWith(".wav"));
if (!clips.length) throw new Error(`no cached voice clips in ${dir}; run an e2e plan first`);
const load = (f) => {
  const b = readFileSync(path.join(dir, f));
  return Float32Array.from(new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) >> 1), (v) => v / 32768);
};
const voice = clips.map(load).sort((a, b) => b.reduce((m, v) => Math.max(m, Math.abs(v)), 0) - a.reduce((m, v) => Math.max(m, Math.abs(v)), 0))[0];

function makeProcessor(rate) {
  const source = readFileSync(path.join(import.meta.dirname, "../public/worklets/player-processor.js"), "utf8");
  const scope = {
    sampleRate: rate,
    currentTime: 0,
    AudioWorkletProcessor: class {
      port = { onmessage: null, postMessage() {} };
    },
    registerProcessor(_name, cls) {
      scope.Processor = cls;
    },
  };
  vm.runInNewContext(source, scope);
  const proc = new scope.Processor({ processorOptions: { inputRate: 24000 } });
  const send = (data) => proc.port.onmessage({ data });
  const render = (frames, before = () => {}) => {
    const out = new Float32Array(frames);
    for (let f = 0; f < frames; f += QUANTUM) {
      scope.currentTime = f / rate;
      before(scope.currentTime);
      const block = new Float32Array(QUANTUM);
      proc.process([], [[block]]);
      out.set(block.subarray(0, Math.min(QUANTUM, frames - f)), f);
    }
    return out;
  };
  return { send, render };
}

for (const rate of [44100, 48000]) {
  const frames = Math.ceil((voice.length / 24000 + 0.3) * rate);
  const at = 0.03;

  const whole = makeProcessor(rate);
  whole.send({ samples: voice.slice(), at, cont: false });
  const a = whole.render(frames);

  // 10 ms chunks, each arriving 20 ms before it's due, like a live stream with little to spare
  const chunked = makeProcessor(rate);
  const chunks = [];
  for (let i = 0; i < voice.length; i += 240) chunks.push({ samples: voice.slice(i, i + 240), due: at + i / 24000 });
  let k = 0;
  const b = chunked.render(frames, (now) => {
    while (k < chunks.length && chunks[k].due - 0.02 <= now) {
      chunked.send({ samples: chunks[k].samples, at, cont: k > 0 });
      k++;
    }
  });

  let maxDiff = 0;
  for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
  check(`${rate} Hz: 10 ms chunks sound exactly like one buffer`, maxDiff < 1e-6, `max difference ${maxDiff.toExponential(1)}`);
  const peak = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  check(`${rate} Hz: peaks stay below full scale`, peak < 1, `peak ${peak.toFixed(3)}`);
  const firstSound = a.findIndex((v) => v !== 0) / rate;
  check(`${rate} Hz: playback starts on schedule`, Math.abs(firstSound - at) < 0.002, `${(firstSound * 1000).toFixed(1)} ms`);

  // flush mid-sentence: fades out within 5 ms, then silence
  const flushed = makeProcessor(rate);
  flushed.send({ samples: voice.slice(), at: 0, cont: false });
  const cut = Math.round(0.5 * rate / QUANTUM) * QUANTUM;
  const c = flushed.render(frames, (now) => now * rate === cut && flushed.send({ type: "flush" }));
  const tail = c.subarray(cut + Math.ceil(rate * 0.005) + QUANTUM);
  check(`${rate} Hz: a flush fades out and stays silent`, tail.every((v) => v === 0));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
