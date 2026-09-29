// Plays the agent's voice: 24 kHz mono chunks in, audio at the context's rate out.
// The Voice Agent API sends 10 ms chunks. Scheduling each one as its own AudioBufferSourceNode
// clicked at every boundary, because each buffer gets resampled on its own. Here all chunks go
// into one continuous buffer and the resampler carries its state from one chunk to the next.
const FADE_S = 0.005; // stop over 5 ms on a flush instead of cutting mid-wave (a click)
const HEADROOM = 0.92; // cubic interpolation can overshoot full-scale peaks slightly

class PlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.step = (options.processorOptions?.inputRate ?? 24000) / sampleRate; // input samples per output frame
    this.buf = new Float32Array(1 << 16); // ring buffer; power-of-two size, grows when needed
    this.written = 0; // absolute index of the next sample to write
    this.pos = 0; // absolute, fractional read position
    this.first = 0; // absolute index where the current run of audio started
    this.startAt = 0; // context time the current run starts playing
    this.fade = 0; // frames left in a flush fade-out
    this.fadeLen = Math.max(1, Math.round(sampleRate * FADE_S));
    this.port.onmessage = ({ data }) => (data.type === "flush" ? (this.fade = this.fadeLen) : this.push(data));
  }

  /** `cont`: the chunk follows on from the audio still queued. Otherwise it starts a new run at `at`. */
  push({ samples, at, cont }) {
    if (!cont) {
      this.pos = this.first = this.written;
      this.startAt = at;
      this.fade = 0;
    }
    const need = this.written - Math.floor(this.pos) + samples.length + 4;
    if (need > this.buf.length) this.grow(need);
    const mask = this.buf.length - 1;
    for (let k = 0; k < samples.length; k++) this.buf[(this.written + k) & mask] = samples[k];
    this.written += samples.length;
  }

  grow(need) {
    let size = this.buf.length;
    while (size < need) size *= 2;
    const next = new Float32Array(size);
    for (let k = Math.max(this.first, Math.floor(this.pos) - 1); k < this.written; k++) next[k & (size - 1)] = this.buf[k & (this.buf.length - 1)];
    this.buf = next;
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    const mask = this.buf.length - 1;
    for (let j = 0; j < out.length; j++) {
      let y = 0;
      if (this.pos + 2 < this.written && currentTime + j / sampleRate >= this.startAt) {
        const i = Math.floor(this.pos);
        const f = this.pos - i;
        const x0 = this.buf[Math.max(i - 1, this.first) & mask];
        const x1 = this.buf[i & mask];
        const x2 = this.buf[(i + 1) & mask];
        const x3 = this.buf[(i + 2) & mask];
        // Catmull-Rom: continuous across chunks, and less high-frequency fizz than linear
        y = HEADROOM * (x1 + 0.5 * f * (x2 - x0 + f * (2 * x0 - 5 * x1 + 4 * x2 - x3 + f * (3 * (x1 - x2) + x3 - x0))));
        this.pos += this.step;
      }
      if (this.fade) {
        y *= this.fade / this.fadeLen;
        if (--this.fade === 0) this.pos = this.first = this.written; // drop what was queued
      }
      out[j] = y;
    }
    return true;
  }
}

registerProcessor("player-processor", PlayerProcessor);
