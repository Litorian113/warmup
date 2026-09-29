// Keeps the persona from hearing itself on a speaker.
//
// The browser's echo canceller only removes the persona's voice from the mic when it can see that
// audio playing. When it can't (some phones, some speakers), the agent hears its own words as the
// user cutting in and stops mid-sentence, over and over. The guard checks whether the mic level
// rises and falls with the voice that was playing at the time. If it does, that's echo, and from
// then on the mic is muted while the persona is audible, like a walkie-talkie.
// Until the first check is done, the mic is muted while the persona talks: the greeting is the probe.

export type EchoMode = "probe" | "duplex" | "gated";

const FRAME_MS = 50;
const JUDGE_FRAMES = 40; // 2 s of the persona talking
const LAGS = [-2, 10]; // echo shows up 0.1 s early to 0.5 s late, in frames (clocks and buffers differ)

export class EchoGuard {
  mode: EchoMode = "probe";
  /** How closely the mic followed the persona's voice at the last check, from 0 to 1. */
  match = 0;
  onChange: (mode: EchoMode) => void = () => {};
  private heard: { t: number; mic: number }[] = []; // mic levels while the persona was audible
  private quiet: number[] = []; // mic levels while nothing played: the room's noise floor
  private wasAudible = false;

  /** `voiceAt(t)`: the level of the persona's voice queued to play at performance.now() time t. */
  constructor(private voiceAt: (t: number) => number) {}

  /** Call for every mic chunk. Returns true when the chunk must be muted before it's sent. */
  frame(t: number, mic: number, audible: boolean): boolean {
    if (audible) {
      this.heard.push({ t, mic });
      // Keep watching in duplex mode: a leak that starts mid-session (headphones out) shows up here.
      if (this.mode === "duplex" && this.heard.length >= JUDGE_FRAMES && this.heard.length % 10 === 0) {
        this.judge(this.heard.slice(-JUDGE_FRAMES), 0.6);
      }
    } else {
      if (this.wasAudible) this.endOfVoice();
      this.quiet.push(mic);
      if (this.quiet.length > 400) this.quiet.shift();
    }
    this.wasAudible = audible;
    return audible && this.mode !== "duplex";
  }

  private endOfVoice() {
    const enough = this.heard.length >= JUDGE_FRAMES;
    if (enough && this.mode !== "gated") this.judge(this.heard, 0.45, true);
    // While probing, short replies add up until there's enough to judge.
    if (enough || this.mode !== "probe") this.heard = [];
  }

  private judge(heard: { t: number; mic: number }[], threshold: number, final = false) {
    const mic = heard.map((h) => h.mic);
    let best = 0;
    let voice: number[] = [];
    for (let lag = LAGS[0]; lag <= LAGS[1]; lag++) {
      const v = heard.map((h) => this.voiceAt(h.t - lag * FRAME_MS));
      const r = pearson(mic, v);
      if (r > best) {
        best = r;
        voice = v;
      }
    }
    this.match = best;
    // Echo also has to be loud enough to matter: well above the room's noise floor.
    const cut = percentile(voice, 0.5);
    const loud = mean(mic.filter((_, i) => voice[i] > cut));
    if (best >= threshold && loud > Math.max(2 * percentile(this.quiet, 0.2), 0.002)) {
      this.setMode("gated");
      return;
    }
    // Only trust "no echo" if the voice was actually playing during the window.
    const voiced = heard.filter((h) => this.voiceAt(h.t) > 0.003).length / heard.length;
    if (final && this.mode === "probe" && voiced >= 0.4) this.setMode("duplex");
  }

  private setMode(mode: EchoMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.onChange(mode);
  }
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function pearson(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
