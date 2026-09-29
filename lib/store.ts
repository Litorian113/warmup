// Practice history lives in the browser (localStorage). Nothing about a user's sessions is
// stored on our server; the recording itself stays in the AssemblyAI account.
import type { Signal } from "./engagement";

export type Outcome = "you-ended" | "wrapped-up" | "they-left" | "time-up" | "dropped";

export interface WarmthPoint {
  t: number;
  value: number;
  delta: number;
  signals: Signal[];
  said: string;
  /** "tick": a periodic sample (talk mode), not one of the user's turns. */
  kind?: "tick";
}

export interface Word {
  text: string;
  start: number; // ms from the start of the recording
  end: number;
}

export interface Utterance {
  who: "you" | "them";
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Metrics {
  youSeconds: number;
  themSeconds: number;
  talkShare: number | null;
  avgGap: number | null;
  longestGap: number | null;
  wpm: number | null;
  fillers: number;
  fillersPerMin: number | null;
  fillerWords: Record<string, number>;
  tics: Record<string, number>;
  questions: number;
  longestTurn: number;
  pauses: number;
  longestPause: number;
  overlaps: number;
}

export interface Analysis {
  transcriptId: string;
  utterances: Utterance[];
  metrics: Metrics;
}

export interface CoachReport {
  source: "llm" | "rules";
  model?: string;
  headline: string;
  strengths: { title: string; detail: string }[];
  improvements: { title: string; detail: string; tryInstead: string }[];
  moments: { at: number; quote: string; kind: "great" | "missed" | "awkward"; comment: string; better: string }[];
  goals?: { id: string; done: boolean; evidence: string }[];
  nextStep: string;
}

export interface SessionRecord {
  id: string;
  sceneId: string;
  personaName: string;
  createdAt: number;
  durationSec: number;
  sessionId: string | null;
  outcome: Outcome;
  lines: { who: "you" | "them"; text: string; t: number; interrupted?: boolean }[];
  points: WarmthPoint[];
  startWarmth: number;
  finalWarmth: number;
  goals: Record<string, boolean>;
  topic?: string;
  talkSeconds?: number;
  /** Talk mode: seconds into the session when Q&A began. */
  qaStartedAt?: number;
  longestPause?: number;
  analysis?: Analysis;
  coach?: CoachReport;
  /** Second attempts at coach-flagged moments, keyed by moment index. */
  retakes?: Record<number, RetakeResult>;
}

export interface RetakeResult {
  said: string;
  delta: number;
  signals: Signal[];
  at: number;
}

const KEY = "warmup.sessions.v1";
const MAX = 40;

function readAll(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAll(list: SessionRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // storage full or blocked: the current page still has the data in memory
  }
}

export function saveSession(r: SessionRecord) {
  writeAll([r, ...readAll().filter((x) => x.id !== r.id)]);
}

export function getSession(id: string): SessionRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function updateSession(id: string, patch: Partial<SessionRecord>) {
  const all = readAll();
  const i = all.findIndex((r) => r.id === id);
  if (i === -1) return;
  all[i] = { ...all[i], ...patch };
  writeAll(all);
}

export function saveRetake(id: string, momentIndex: number, result: RetakeResult) {
  const rec = getSession(id);
  if (rec) updateSession(id, { retakes: { ...rec.retakes, [momentIndex]: result } });
}

export function listSessions(): SessionRecord[] {
  return readAll();
}

export function deleteSession(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}
