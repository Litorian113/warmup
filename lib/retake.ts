// "Try this moment again": rebuilds the conversation up to a moment the coach flagged, so the
// persona can say the exact same line again and the user gets a second attempt at the reply.
import { words } from "./engagement";
import type { RetakeResult, SessionRecord, WarmthPoint } from "./store";

export interface RetakePlan {
  recordId: string;
  momentIndex: number;
  /** The persona's line the user is answering again (spoken as the session greeting). */
  themLine: string;
  /** Everything said before that line. */
  context: { who: "you" | "them"; text: string }[];
  oldSaid: string;
  oldPoint: WarmthPoint | null;
  startWarmth: number;
  comment: string;
  better: string;
}

const overlap = (a: string, b: string) => {
  const bw = new Set(words(b));
  return words(a).filter((w) => bw.has(w)).length;
};

export function planRetake(rec: SessionRecord, momentIndex: number): RetakePlan | null {
  const mo = rec.coach?.moments[momentIndex];
  if (!mo) return null;
  const lines = rec.analysis
    ? rec.analysis.utterances.map((u) => ({ who: u.who, text: u.text, t: u.start / 1000 }))
    : rec.lines.map((l) => ({ who: l.who, text: l.text, t: l.t }));

  // The user's line for this moment: most words in common with the quote, then closest in time.
  let idx = -1;
  let best = -1;
  lines.forEach((l, i) => {
    if (l.who !== "you") return;
    const score = overlap(mo.quote, l.text) * 100 - Math.abs(l.t - mo.at);
    if (score > best) (best = score), (idx = i);
  });
  if (idx < 0) return null;
  let j = idx - 1;
  while (j >= 0 && lines[j].who !== "them") j--;
  if (j < 0) return null;

  const themAt = lines[j].t;
  const oldPoint =
    [...rec.points].filter((p) => p.kind !== "tick" && p.said).sort((a, b) => overlap(mo.quote, b.said) - overlap(mo.quote, a.said))[0] ?? null;
  const before = rec.points.filter((p) => p.t <= themAt + 1 && p !== oldPoint);
  return {
    recordId: rec.id,
    momentIndex,
    themLine: lines[j].text,
    context: lines.slice(0, j).map(({ who, text }) => ({ who, text })),
    oldSaid: lines[idx].text,
    oldPoint,
    startWarmth: before.length ? before[before.length - 1].value : rec.startWarmth,
    comment: mo.comment,
    better: mo.better,
  };
}

export function compareRetake(plan: Pick<RetakePlan, "oldPoint">, result: RetakeResult) {
  const before = plan.oldPoint?.delta ?? 0;
  const diff = result.delta - before;
  if (diff > 2) return `That landed better: ${signed(result.delta)} this time, ${signed(before)} the first time.`;
  if (diff < -2) return `The first version landed better (${signed(before)} vs ${signed(result.delta)}). Try again, or keep the original.`;
  return `About the same effect as the first time (${signed(result.delta)} vs ${signed(before)}).`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
