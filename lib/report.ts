// Client-side report pipeline: transcribe the session recording, compute metrics, get coach notes.
import type { CoachRequest } from "./coach";
import { computeMetrics, mmss, scriptForPrompt, toUtterances } from "./metrics";
import type { Analysis, CoachReport, Metrics, SessionRecord } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function runAnalysis(rec: SessionRecord, signal: AbortSignal): Promise<Analysis> {
  let transcriptId: string | null = null;
  for (let attempt = 0; attempt < 4 && !transcriptId; attempt++) {
    const res = await fetch("/api/analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: rec.sessionId, sceneId: rec.sceneId }),
      signal,
    });
    const j = await json(res);
    if (res.ok) transcriptId = j.transcriptId;
    else if (res.status === 409) await sleep((j.retryAfter ?? 5) * 1000);
    else throw new Error(j.error ?? `Couldn't start the transcription (${res.status}).`);
  }
  if (!transcriptId) throw new Error("The recording wasn't ready in time. Reload this page in a minute.");

  for (let i = 0; i < 120; i++) {
    await sleep(i === 0 ? 3000 : 2000);
    const res = await fetch(`/api/analysis/${transcriptId}`, { signal, cache: "no-store" });
    const j = await json(res);
    if (!res.ok) throw new Error(j.error ?? `Transcription failed (${res.status}).`);
    if (j.status === "completed") {
      const utterances = toUtterances({ id: transcriptId, utterances: j.utterances });
      return { transcriptId, utterances, metrics: computeMetrics(utterances) };
    }
  }
  throw new Error("Transcription is taking unusually long. Reload this page to check again.");
}

export const EMPTY_METRICS: Metrics = {
  youSeconds: 0,
  themSeconds: 0,
  talkShare: null,
  avgGap: null,
  longestGap: null,
  wpm: null,
  fillers: 0,
  fillersPerMin: null,
  fillerWords: {},
  tics: {},
  questions: 0,
  longestTurn: 0,
  pauses: 0,
  longestPause: 0,
  overlaps: 0,
};

export async function fetchCoach(rec: SessionRecord, signal: AbortSignal): Promise<{ report?: CoachReport; retryAfter?: number; error?: string }> {
  const script = rec.analysis
    ? scriptForPrompt(rec.analysis.utterances, rec.personaName)
    : rec.lines.map((l) => `[${mmss(l.t)}] ${l.who === "you" ? "YOU" : rec.personaName.toUpperCase()}: ${l.text}`).join("\n");
  const body: CoachRequest = {
    sceneId: rec.sceneId,
    personaName: rec.personaName,
    script,
    metrics: rec.analysis?.metrics ?? EMPTY_METRICS,
    outcome: rec.outcome,
    goals: rec.goals,
    topic: rec.topic,
    talkSeconds: rec.talkSeconds,
  };
  const res = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const j = await json(res);
  if (res.ok && j.report) return { report: j.report };
  return { error: j.error ?? `The AI coach is unavailable (${res.status}).`, retryAfter: res.status === 429 ? (j.retryAfter ?? 60) : undefined };
}
