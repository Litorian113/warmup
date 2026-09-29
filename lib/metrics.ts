// Speaking metrics from the post-session transcript. The recording is stereo (left = user,
// right = persona) and transcribed with multichannel + disfluencies, so every word has a
// speaker and exact timing, and filler words like "um" are kept.
import type { Metrics, Utterance, Word } from "./store";

/** Hesitation sounds. */
export const FILLERS = new Set(["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm"]);
/** Listening noises ("mhm") are good conversation, not hesitation. The model can also hear them in
 *  silence, so they're dropped before anything is measured. */
const BACKCHANNEL = new Set(["m", "mm", "mmm", "mhm", "mhmm", "hm", "uh-huh", "mm-hmm"]);
const TICS = ["you know", "i mean", "kind of", "sort of", "basically", "literally", "actually", "like"];

export const clean = (w: string) => w.toLowerCase().replace(/[^a-z'-]/g, "");
export const isFiller = (w: string) => FILLERS.has(clean(w));
const isBackchannel = (w: string) => BACKCHANNEL.has(clean(w));

/** Shape of AssemblyAI's multichannel transcript that we rely on. */
export interface RawTranscript {
  id: string;
  utterances?: { channel?: string; speaker?: string; start: number; end: number; text: string; words?: { text: string; start: number; end: number }[] }[];
}

/** Version of the utterance and metric computation; saved analyses from older versions get recomputed. */
export const ANALYSIS_VERSION = 2;

export function toUtterances(t: RawTranscript): Utterance[] {
  const segments = (t.utterances ?? []).flatMap((u): Utterance[] => {
    const who = String(u.channel ?? u.speaker) === "1" ? "you" : "them";
    const all = (u.words ?? []).map(({ text, start, end }) => ({ text, start, end }));
    if (!all.length) return u.text.trim() ? [{ who, start: u.start, end: u.end, text: u.text, words: [] }] : [];
    // Drop listening noises on both channels; on the persona's channel fillers are breath
    // artifacts of the synthetic voice.
    const words = all.filter((w) => !isBackchannel(w.text) && !(who === "them" && isFiller(w.text)));
    return words.length ? [{ who, start: words[0].start, end: words[words.length - 1].end, text: "", words }] : [];
  });
  return toTurns(segments);
}

/**
 * Multichannel utterances don't follow turn-taking: one can run across several of your turns
 * while the persona talks in between, or split a sentence in two. So turns are rebuilt from word
 * timings: a turn runs on through its pauses until the other person starts talking in one of them.
 */
export function toTurns(utts: Utterance[]): Utterance[] {
  const wordsOf = (who: Utterance["who"]) =>
    utts
      .filter((u) => u.who === who)
      .flatMap((u) => (u.words.length ? u.words : [{ text: u.text, start: u.start, end: u.end }]))
      .sort((a, b) => a.start - b.start);
  const words = { you: wordsOf("you"), them: wordsOf("them") };
  const turns: Utterance[] = [];
  for (const who of ["you", "them"] as const) {
    const other = words[who === "you" ? "them" : "you"];
    let cur: Word[] = [];
    for (const w of words[who]) {
      const prev = cur[cur.length - 1];
      if (prev && !startsBetween(other, prev.end, w.start)) cur.push(w);
      else {
        if (cur.length) turns.push(turn(who, cur));
        cur = [w];
      }
    }
    if (cur.length) turns.push(turn(who, cur));
  }
  return turns.sort((a, b) => a.start - b.start);
}

const turn = (who: Utterance["who"], words: Word[]): Utterance => ({
  who,
  start: words[0].start,
  end: Math.max(...words.map((w) => w.end)),
  text: words.map((w) => w.text).join(" "),
  words,
});

/** Whether any of `words` (sorted by start) starts after `from` and before `to`. */
function startsBetween(words: Word[], from: number, to: number) {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= from) lo = mid + 1;
    else hi = mid;
  }
  return lo < words.length && words[lo].start < to;
}

export function computeMetrics(utts: Utterance[]): Metrics {
  const you = utts.filter((u) => u.who === "you");
  const them = utts.filter((u) => u.who === "them");
  const dur = (list: Utterance[]) => list.reduce((s, u) => s + (u.end - u.start), 0) / 1000;
  const youSeconds = dur(you);
  const themSeconds = dur(them);

  // Response gaps: from the end of their line to the start of your reply.
  const gaps: number[] = [];
  let overlaps = 0;
  const sorted = [...utts].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.who === "them" && cur.who === "you") {
      const gap = (cur.start - prev.end) / 1000;
      if (gap < -0.3) overlaps++;
      else gaps.push(Math.max(0, gap));
    }
  }

  const youWords: Word[] = you.flatMap((u) => u.words);
  const fillerWords: Record<string, number> = {};
  for (const w of youWords) {
    if (isFiller(w.text)) {
      const k = clean(w.text);
      fillerWords[k] = (fillerWords[k] ?? 0) + 1;
    }
  }
  const fillers = Object.values(fillerWords).reduce((a, b) => a + b, 0);

  const allText = ` ${you.map((u) => u.text.toLowerCase()).join(" ")} `;
  const tics: Record<string, number> = {};
  for (const t of TICS) {
    const n = allText.split(new RegExp(`\\b${t}\\b`)).length - 1;
    if (n) tics[t] = n;
  }

  // Pauses inside your own turns (not waiting for them).
  let pauses = 0;
  let longestPause = 0;
  for (const u of you) {
    for (let i = 1; i < u.words.length; i++) {
      const p = round((u.words[i].start - u.words[i - 1].end) / 1000); // rounded as shown, so the count agrees
      if (p >= 1.5) pauses++;
      longestPause = Math.max(longestPause, p);
    }
  }

  const spoken = youWords.filter((w) => !isFiller(w.text)).length;
  const questions = you.reduce((n, u) => n + (u.text.match(/\?/g) ?? []).length, 0);
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  return {
    youSeconds: round(youSeconds),
    themSeconds: round(themSeconds),
    talkShare: youSeconds + themSeconds > 0 ? round(youSeconds / (youSeconds + themSeconds), 2) : null,
    avgGap: avg === null ? null : round(avg),
    longestGap: gaps.length ? round(Math.max(...gaps)) : null,
    wpm: youSeconds > 5 ? Math.round(spoken / (youSeconds / 60)) : null,
    fillers,
    fillersPerMin: youSeconds > 5 ? round(fillers / (youSeconds / 60)) : null,
    fillerWords,
    tics,
    questions,
    longestTurn: round(Math.max(0, ...you.map((u) => (u.end - u.start) / 1000))),
    pauses,
    longestPause: round(longestPause),
    overlaps,
  };
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Transcript lines for the coach prompt, e.g. "[0:14] YOU: …". */
export function scriptForPrompt(utts: Utterance[], themName: string) {
  return utts.map((u) => `[${mmss(u.start / 1000)}] ${u.who === "you" ? "YOU" : themName.toUpperCase()}: ${u.text}`).join("\n");
}
