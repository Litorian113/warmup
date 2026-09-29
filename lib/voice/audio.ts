// Browser audio: microphone capture (24 kHz PCM16 chunks) and agent playback.

export const AGENT_RATE = 24000;

export class MicCapture {
  private ctx?: AudioContext;
  private stream?: MediaStream;
  onChunk: (pcm: ArrayBuffer, rms: number) => void = () => {};
  level = 0;

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("insecure-context");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true, // the agent's voice must not leak back into the mic
        noiseSuppression: false, // AssemblyAI's Voice Focus does this server-side
        autoGainControl: true,
        channelCount: 1,
      },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule("/worklets/mic-processor.js");
    const source = this.ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(this.ctx, "mic-processor", {
      processorOptions: { targetRate: AGENT_RATE, chunkMs: 50 },
    });
    node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
      this.level = e.data.rms;
      this.onChunk(e.data.pcm, e.data.rms);
    };
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(this.ctx.destination);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.onChunk = () => {};
    await this.ctx?.close().catch(() => {});
    this.ctx = undefined;
  }
}

export class Player {
  readonly ctx: AudioContext;
  private out: GainNode;
  private analyser: AnalyserNode;
  private buf: Float32Array<ArrayBuffer>;
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.out.connect(this.analyser).connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  /** Queues a base64 PCM16 chunk. Returns the performance.now() time it starts playing. */
  enqueue(b64: string): number {
    const bin = atob(b64);
    const n = bin.length >> 1;
    const audio = this.ctx.createBuffer(1, n, AGENT_RATE);
    const ch = audio.getChannelData(0);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 0x8000) v -= 0x10000;
      ch[i] = v / 32768;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.out);
    const startAt = Math.max(this.ctx.currentTime + 0.03, this.next);
    src.start(startAt);
    this.next = startAt + audio.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
    return performance.now() + (startAt - this.ctx.currentTime) * 1000;
  }

  flush() {
    for (const s of this.sources) {
      try {
        s.onended = null;
        s.stop(0);
        s.disconnect();
      } catch {}
    }
    this.sources.clear();
    this.next = this.ctx.currentTime;
  }

  /** performance.now() time when everything queued so far has finished playing. */
  endsAt() {
    return performance.now() + Math.max(0, this.next - this.ctx.currentTime) * 1000;
  }

  isPlaying() {
    return this.next > this.ctx.currentTime + 0.02;
  }

  level() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }

  async close() {
    this.flush();
    await this.ctx.close().catch(() => {});
  }
}

export function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(s);
}
