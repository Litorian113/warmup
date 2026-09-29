// Captures mic audio at the context's native rate, resamples to 24 kHz (linear interpolation
// with a light low-pass), converts to PCM16 and posts 50 ms chunks plus their RMS level and the
// context time they were captured at (so they can be lined up with playback).
// Resampling here, instead of forcing AudioContext({ sampleRate: 24000 }), keeps Firefox's
// echo canceller working and Safari's audio from coming out chipmunked.
class MicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { targetRate = 24000, chunkMs = 50 } = options.processorOptions || {};
    this.step = sampleRate / targetRate; // input samples per output sample
    this.t = 0; // fractional read position; index 0 is the previous block's last sample
    this.prev = 0;
    this.lp = 0;
    // one-pole low-pass at ~10 kHz to tame aliasing when downsampling
    this.alpha = this.step > 1 ? 1 - Math.exp((-2 * Math.PI * 10000) / sampleRate) : 1;
    this.size = Math.round((targetRate * chunkMs) / 1000);
    this.chunk = new Int16Array(this.size);
    this.n = 0;
    this.sumSq = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    const len = input.length;
    const x = new Float32Array(len);
    let lp = this.lp;
    for (let i = 0; i < len; i++) x[i] = lp += this.alpha * (input[i] - lp);
    this.lp = lp;

    let t = this.t;
    while (t < len) {
      const i = Math.floor(t);
      const frac = t - i;
      const a = i === 0 ? this.prev : x[i - 1];
      const b = x[i];
      this.push(a + (b - a) * frac);
      t += this.step;
    }
    this.t = t - len;
    this.prev = x[len - 1];
    return true;
  }

  push(sample) {
    const v = sample > 1 ? 1 : sample < -1 ? -1 : sample;
    this.sumSq += v * v;
    this.chunk[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
    if (this.n === this.size) {
      const rms = Math.sqrt(this.sumSq / this.size);
      this.port.postMessage({ pcm: this.chunk.buffer, rms, t: currentTime }, [this.chunk.buffer]);
      this.chunk = new Int16Array(this.size);
      this.n = 0;
      this.sumSq = 0;
    }
  }
}

registerProcessor("mic-processor", MicProcessor);
