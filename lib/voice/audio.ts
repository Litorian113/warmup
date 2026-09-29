// Browser audio: microphone capture (24 kHz PCM16 chunks) and agent playback.

export const AGENT_RATE = 24000;
const BLOCK = AGENT_RATE / 20; // 50 ms of agent audio
const ECHO_TAIL_MS = 200; // how long the voice lingers in the mic after playback (room, buffers)

export class MicCapture {
  private ctx?: AudioContext;
  private stream?: MediaStream;
  /** `at` is when the chunk was captured, in performance.now() time. */
  onChunk: (pcm: ArrayBuffer, rms: number, at: number) => void = () => {};
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
    node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number; t: number }>) => {
      this.level = e.data.rms;
      this.onChunk(e.data.pcm, e.data.rms, this.toPerf(e.data.t));
    };
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(this.ctx.destination);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  /** Maps capture-context time to performance.now() time, unaffected by main-thread delays. */
  private toPerf(t: number) {
    const now = performance.now();
    const ts = this.ctx?.getOutputTimestamp?.();
    const at = ts?.performanceTime ? ts.performanceTime + (t - (ts.contextTime ?? 0)) * 1000 : now;
    return Math.abs(at - now) < 1000 ? at : now; // a chunk is never older than that; distrust odd clocks
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
  private node: AudioWorkletNode | null = null;
  private out: GainNode;
  private analyser: AnalyserNode;
  private buf: Float32Array<ArrayBuffer>;
  private next = 0; // context time when everything queued so far has played
  /** Level of every 50 ms of queued audio, in performance.now() time, for echo detection. */
  private blocks: { at: number; end: number; rms: number }[] = [];
  private call: { send: RTCPeerConnection; receive: RTCPeerConnection; el: HTMLAudioElement } | null = null;
  /** How the voice reaches the speaker: straight from Web Audio, or as call audio (see playAsCallAudio). */
  route: "direct" | "webrtc" = "direct";

  constructor() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.out.connect(this.analyser).connect(this.ctx.destination);
  }

  /** Loads the playback worklet. The context itself must be created inside the click handler. */
  async start() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    await this.ctx.audioWorklet.addModule("/worklets/player-processor.js");
    this.node = new AudioWorkletNode(this.ctx, "player-processor", {
      numberOfInputs: 0,
      outputChannelCount: [1],
      processorOptions: { inputRate: AGENT_RATE },
    });
    this.node.connect(this.out);
  }

  /**
   * Phones only cancel echo from audio they know is call audio: mobile Chrome and Safari leave
   * Web Audio output out of the echo canceller, so on a speaker the agent hears itself and cuts
   * itself off. Sending the voice through a local WebRTC connection and playing it from an
   * <audio> element makes it call audio. Keeps direct playback if anything fails.
   * Call it after the mic is open: browsers only gather local network candidates during capture.
   */
  async playAsCallAudio(timeoutMs = 2500): Promise<boolean> {
    if (typeof RTCPeerConnection === "undefined") return false;
    const send = new RTCPeerConnection();
    const receive = new RTCPeerConnection();
    const el = document.createElement("audio");
    try {
      const dest = this.ctx.createMediaStreamDestination();
      send.onicecandidate = (e) => e.candidate && receive.addIceCandidate(e.candidate).catch(() => {});
      receive.onicecandidate = (e) => e.candidate && send.addIceCandidate(e.candidate).catch(() => {});
      const track = new Promise<MediaStream>((resolve) => {
        receive.ontrack = (e) => resolve(e.streams[0] ?? new MediaStream([e.track]));
      });
      const connected = new Promise<void>((resolve, reject) => {
        receive.oniceconnectionstatechange = () => {
          const s = receive.iceConnectionState;
          if (s === "connected" || s === "completed") resolve();
          else if (s === "failed" || s === "closed") reject(new Error(`call audio ${s}`));
        };
      });
      dest.stream.getAudioTracks().forEach((t) => send.addTrack(t, dest.stream));
      await send.setLocalDescription(await send.createOffer());
      await receive.setRemoteDescription(send.localDescription!);
      await receive.setLocalDescription(await receive.createAnswer());
      const answer = receive.localDescription!;
      await send.setRemoteDescription({ type: "answer", sdp: roomyOpus(answer.sdp) }).catch(() => send.setRemoteDescription(answer));
      const [stream] = await withTimeout(Promise.all([track, connected]), timeoutMs);
      el.hidden = true;
      el.setAttribute("playsinline", "");
      el.srcObject = stream;
      document.body.appendChild(el);
      await withTimeout(el.play(), timeoutMs);
      this.analyser.disconnect();
      this.analyser.connect(dest);
      this.call = { send, receive, el };
      this.route = "webrtc";
      return true;
    } catch {
      send.close();
      receive.close();
      el.srcObject = null;
      el.remove();
      return false;
    }
  }

  /** Queues a base64 PCM16 chunk. Returns the performance.now() time it starts playing. */
  enqueue(b64: string): number {
    const bin = atob(b64);
    const n = bin.length >> 1;
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 0x8000) v -= 0x10000;
      ch[i] = v / 32768;
    }
    // Follow on from the queued audio without a gap; after silence, start 30 ms out.
    const now = this.ctx.currentTime;
    const cont = this.next > now + 0.005;
    const startAt = cont ? this.next : now + 0.03;
    this.next = startAt + n / AGENT_RATE;
    const startsAt = performance.now() + (startAt - now) * 1000;
    for (let i = 0; i < n; i += BLOCK) {
      const end = Math.min(n, i + BLOCK);
      let sum = 0;
      for (let j = i; j < end; j++) sum += ch[j] * ch[j];
      this.blocks.push({ at: startsAt + (i / AGENT_RATE) * 1000, end: startsAt + (end / AGENT_RATE) * 1000, rms: Math.sqrt(sum / (end - i)) });
    }
    if (this.blocks.length > 1200) this.blocks.splice(0, this.blocks.length - 1200); // the last minute
    this.node?.port.postMessage({ samples: ch, at: startAt, cont }, [ch.buffer]);
    return startsAt;
  }

  flush() {
    this.node?.port.postMessage({ type: "flush" });
    this.next = this.ctx.currentTime;
    const now = performance.now();
    while (this.blocks.length && this.blocks[this.blocks.length - 1].at > now) this.blocks.pop();
    const last = this.blocks[this.blocks.length - 1];
    if (last && last.end > now) last.end = now;
  }

  /** performance.now() time when everything queued so far has finished playing. */
  endsAt() {
    return performance.now() + Math.max(0, this.next - this.ctx.currentTime) * 1000;
  }

  isPlaying() {
    return this.next > this.ctx.currentTime + 0.02;
  }

  /** Level of the voice that was queued to play at performance.now() time t (0 if none). */
  levelAt(t: number) {
    const b = this.blockAt(t);
    return b && t < b.end ? b.rms : 0;
  }

  /** Whether the voice could be reaching the mic at performance.now() time t, echo tail included. */
  audibleAt(t: number) {
    const b = this.blockAt(t);
    const delay = (this.ctx.outputLatency || 0) * 1000 + (this.route === "webrtc" ? 60 : 0);
    return !!b && t < b.end + delay + ECHO_TAIL_MS;
  }

  private blockAt(t: number) {
    let lo = 0;
    let hi = this.blocks.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.blocks[mid].at <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found === -1 ? null : this.blocks[found];
  }

  level() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }

  async close() {
    this.flush();
    if (this.call) {
      this.call.el.pause();
      this.call.el.srcObject = null;
      this.call.el.remove();
      this.call.send.close();
      this.call.receive.close();
      this.call = null;
    }
    await this.ctx.close().catch(() => {});
  }
}

/** Asks for 96 kbit/s Opus instead of the default ~32: this connection never leaves the device. */
function roomyOpus(sdp: string) {
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp)?.[1];
  return pt ? sdp.replace(new RegExp(`(a=fmtp:${pt} [^\\r\\n]*)`), "$1;maxaveragebitrate=96000") : sdp;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(s);
}
