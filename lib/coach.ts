// Coach feedback: the LLM prompt, a tolerant parser for its JSON, and a rules-based fallback
// used when the LLM is unavailable (free-tier rate limits, network, or no model access).
import { jsonrepair } from "jsonrepair";
import { pronoun, sceneById, type Persona, type Scene } from "./scenarios";
import type { CoachReport, Metrics, Outcome, SessionRecord } from "./store";

export interface CoachRequest {
  sceneId: string;
  personaName: string;
  script: string;
  metrics: Metrics;
  outcome: Outcome;
  goals: Record<string, boolean>;
  topic?: string;
  talkSeconds?: number;
}

export function outcomeText(outcome: Outcome, p: Persona | undefined, kind: Scene["kind"] = "conversation") {
  const name = p?.name ?? "They";
  const obj = p ? pronoun(p).obj : "them";
  switch (outcome) {
    case "they-left":
      return `${name} excused ${obj}self and left.`;
    case "wrapped-up":
      return kind === "talk" ? "You finished the talk and the Q&A." : "You wrapped up the conversation yourself.";
    case "time-up":
      return "Practice sessions last about four minutes, so this one wrapped up there.";
    case "dropped":
      return "The connection dropped partway through.";
    default:
      return "You ended the practice.";
  }
}

export function metricsText(m: Metrics) {
  const fw = Object.entries(m.fillerWords).map(([w, n]) => `${w} ×${n}`).join(", ");
  const tics = Object.entries(m.tics).map(([w, n]) => `"${w}" ×${n}`).join(", ");
  return [
    m.talkShare !== null && `- Your share of the talking: ${Math.round(m.talkShare * 100)}%`,
    m.avgGap !== null && `- Average time before you answered: ${m.avgGap}s (longest ${m.longestGap}s)`,
    m.wpm !== null && `- Pace: ${m.wpm} words per minute`,
    `- Filler words: ${m.fillers}${fw ? ` (${fw})` : ""}${m.fillersPerMin !== null ? `, ${m.fillersPerMin} per minute` : ""}`,
    tics && `- Verbal tics: ${tics}`,
    `- Questions you asked: ${m.questions}`,
    `- Pauses over 1.5s inside your turns: ${m.pauses} (longest ${m.longestPause}s)`,
    `- Times you talked over them: ${m.overlaps}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const JSON_SHAPE = `{"headline": "<one sentence verdict, max 18 words, addressed to 'you'>",
 "strengths": [{"title": "<3-6 words>", "detail": "<one sentence quoting their words>"}],
 "improvements": [{"title": "<3-6 words>", "detail": "<one sentence>", "try_instead": "<a line they could have said instead, in their own voice>"}],
 "moments": [{"at": "<m:ss from the transcript>", "quote": "<the user's exact words>", "kind": "great" | "missed" | "awkward", "comment": "<one sentence>", "better": "<an improved line, or empty if great>"}],
 "goals": {"<goal id>": {"done": true | false, "evidence": "<short>"}},
 "next_step": "<one sentence: the single thing to practice next time>"}
Exactly 2 strengths, 2 improvements and 3 moments.`;

export function coachMessages(scene: Scene, p: Persona, r: CoachRequest) {
  const pr = pronoun(p);
  const goals = scene.goals.map((g) => `${g.id} = ${g.label}`).join("; ");
  const system =
    scene.kind === "talk"
      ? `You are a warm, sharp speaking coach. The user just gave a short impromptu talk on "${r.topic}" at a small meetup, then answered questions from the host, ${p.name} (${p.pronouns}). Judge the opening, whether there was one clear point with an example, the ending, the delivery (use the metrics) and the Q&A answers. Quote their actual words and never be generic. Lead with what worked: this person may be nervous about speaking.
Goals: ${goals}. Use these goal ids as the keys of "goals".

Reply with ONLY a JSON object, no prose and no code fences, with exactly these keys:
${JSON_SHAPE}`
      : `You are a warm, sharp conversation coach. The user just practiced a conversation out loud with an AI character, ${p.name} (${p.pronouns}; refer to ${pr.obj} as "${pr.sub}"). Scene: ${scene.setting}
Goals: ${goals}.
Give specific, honest feedback grounded in the transcript. Quote their actual words and never be generic. Lead with what worked: this person may be anxious about conversations like this. Pay attention to whether they asked questions, followed up on what ${p.name} said, shared things about themselves, and answered ${pr.pos} questions. Ending the conversation politely themselves is a good skill, never a mistake. Use the goal ids (before the "=") as the keys of "goals".

Reply with ONLY a JSON object, no prose and no code fences, with exactly these keys:
${JSON_SHAPE}`;

  const user = `TRANSCRIPT (YOU = the user):
${r.script}

METRICS:
${metricsText(r.metrics)}${r.talkSeconds ? `\n- Talk length before Q&A: ${r.talkSeconds}s` : ""}
- Outcome: ${outcomeText(r.outcome, p, scene.kind)}`;
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

const toSeconds = (at: unknown) => {
  const m = String(at ?? "").match(/(\d+):(\d{1,2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
// Trims, drops stray closing-brace artifacts from repaired JSON, and caps the length.
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().replace(/\s*\}+\s*$/, "").slice(0, max) : "");

/** Parses the model's JSON (tolerating code fences and stray prose) into a CoachReport. */
export function parseCoach(text: string, model: string): CoachReport | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  // Small models sometimes merge a goal's id and flag: {"id": "long": true, ...}
  const body = text.slice(start).replace(/"id"\s*:\s*"([\w-]+)"\s*:\s*(true|false)/g, '"id": "$1", "done": $2');
  let j: any;
  try {
    j = JSON.parse(body.slice(0, body.lastIndexOf("}") + 1));
  } catch {
    try {
      j = JSON.parse(jsonrepair(body));
    } catch {
      return null;
    }
  }
  const report: CoachReport = {
    source: "llm",
    model,
    headline: str(j.headline, 200),
    strengths: (Array.isArray(j.strengths) ? j.strengths : []).slice(0, 3).map((s: any) => ({ title: str(s?.title, 80), detail: str(s?.detail) })),
    improvements: (Array.isArray(j.improvements) ? j.improvements : [])
      .slice(0, 3)
      .map((s: any) => ({ title: str(s?.title, 80), detail: str(s?.detail), tryInstead: str(s?.try_instead ?? s?.tryInstead) })),
    moments: (Array.isArray(j.moments) ? j.moments : []).slice(0, 4).map((m: any) => ({
      at: toSeconds(m?.at),
      quote: str(m?.quote),
      kind: ["great", "missed", "awkward"].includes(m?.kind) ? m.kind : "missed",
      comment: str(m?.comment),
      better: str(m?.better),
    })),
    goals: (Array.isArray(j.goals)
      ? j.goals
      : j.goals && typeof j.goals === "object"
        ? Object.entries(j.goals).map(([id, g]: [string, any]) => (typeof g === "object" ? { id, ...g } : { id, done: g }))
        : []
    ).map((g: any) => ({ id: str(g?.id, 80), done: g?.done === true, evidence: str(g?.evidence, 200) })),
    nextStep: str(j.next_step ?? j.nextStep, 300),
  };
  if (!report.headline || !report.strengths.length || !report.improvements.length) return null;
  return report;
}

/** Maps the model's goal entries onto the scene's goal ids (by id, then label, then position). */
export function normalizeGoals(report: CoachReport, scene: Scene): CoachReport {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const goals = (report.goals ?? []).flatMap((g, i) => {
    const match =
      scene.goals.find((x) => x.id === g.id) ??
      scene.goals.find((x) => norm(g.id).length >= 6 && norm(x.label).startsWith(norm(g.id))) ??
      (report.goals!.length === scene.goals.length ? scene.goals[i] : undefined);
    return match ? [{ ...g, id: match.id }] : [];
  });
  return { ...report, goals };
}

// ---------- rules-based fallback ----------

export function rulesCoach(r: SessionRecord): CoachReport {
  const scene = sceneById(r.sceneId);
  if (scene?.kind === "talk") return rulesTalkCoach(r);
  const persona = scene?.personas.find((p) => p.name === r.personaName) ?? scene?.personas[0];
  const name = persona?.name ?? "They";
  const m = r.analysis?.metrics;
  const counts = new Map<string, number>();
  for (const p of r.points) for (const s of p.signals) counts.set(s.label.replace(/ “.*”/, ""), (counts.get(s.label.replace(/ “.*”/, "")) ?? 0) + 1);
  const has = (label: string) => counts.get(label) ?? 0;

  const strengths: CoachReport["strengths"] = [];
  const improvements: CoachReport["improvements"] = [];
  if (has("Followed up on")) strengths.push({ title: "You followed up", detail: `You picked up on what ${name} said and asked about it. That's the move that makes people open up.` });
  if (m && m.questions >= 2 && !has("Followed up on")) strengths.push({ title: "You asked questions", detail: `You asked ${m.questions} questions, so ${name} didn't have to carry the conversation.` });
  if (has("Shared something about yourself")) strengths.push({ title: "You shared about yourself", detail: "You gave them something to respond to instead of just answering." });
  if (m && m.avgGap !== null && m.avgGap < 1.5) strengths.push({ title: "Quick, natural replies", detail: `You answered in ${m.avgGap}s on average, which feels natural in conversation.` });
  if (m && m.fillersPerMin !== null && m.fillersPerMin < 2) strengths.push({ title: "Clean delivery", detail: "Very few filler words. You sounded calm." });
  if (!strengths.length) strengths.push({ title: "You showed up", detail: "You practiced out loud, which is the hardest part. Every rep makes the next one easier." });

  if (has("Very short answer")) improvements.push({ title: "Give a bit more", detail: "Some answers were very short, which leaves the other person nowhere to go.", tryInstead: "Answer, then add one detail: “Pretty good, actually. I finally tried that ramen place everyone talks about.”" });
  if ((m && m.questions === 0) || has("Haven't asked anything in a while")) improvements.push({ title: "Ask something back", detail: `${name} had to keep the conversation going. One question back makes it a two-way conversation.`, tryInstead: "“What about you?” works, but a specific question about something they mentioned works better." });
  if (m && m.fillersPerMin !== null && m.fillersPerMin >= 4) improvements.push({ title: "Swap fillers for pauses", detail: `You used ${m.fillers} filler words (${m.fillersPerMin} a minute). A silent pause sounds more confident than “um”.`, tryInstead: "When you need a second, just breathe and pause." });
  if (has("Long monologue, leave them room")) improvements.push({ title: "Leave them room", detail: "Some turns ran long. Shorter turns give the other person a way in.", tryInstead: "Make your point, then hand it back: “…anyway, have you ever tried that?”" });
  if (m && m.wpm !== null && m.wpm > 185) improvements.push({ title: "Slow down a little", detail: `You spoke at ${m.wpm} words per minute. Around 130–160 is easier to follow.`, tryInstead: "Pause at the end of each sentence." });
  if (!improvements.length) improvements.push({ title: "Go one level up", detail: "This scene went well. The next one will stretch you more.", tryInstead: "Try the same moves with someone less chatty." });

  const ranked = [...r.points].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3).sort((a, b) => a.t - b.t);
  const moments: CoachReport["moments"] = ranked.map((p) => ({
    at: Math.max(0, Math.round(p.t - 3)),
    quote: p.said,
    kind: p.delta > 0 ? "great" : "missed",
    comment: p.signals.map((s) => s.label).join(". ") + ".",
    better: p.delta > 0 ? "" : "Add a detail about you, then ask them something specific.",
  }));

  const warm = r.finalWarmth;
  const headline =
    r.outcome === "they-left"
      ? `${name} drifted away. Here's where it slipped, and what to try.`
      : warm >= 70
        ? `You warmed ${name} up. Keep doing exactly that.`
        : warm >= 45
          ? "A solid conversation. A couple of small habits will make it flow."
          : `${name} stayed lukewarm. Small changes will make a big difference.`;

  return {
    source: "rules",
    headline,
    strengths: strengths.slice(0, 2),
    improvements: improvements.slice(0, 2),
    moments,
    nextStep: improvements[0]?.detail ?? "Run the scene again and try one new move.",
  };
}


function rulesTalkCoach(r: SessionRecord): CoachReport {
  const m = r.analysis?.metrics;
  const secs = r.talkSeconds ?? 0;
  const answered = r.goals.answers === true;
  const strengths: CoachReport["strengths"] = [];
  const improvements: CoachReport["improvements"] = [];

  if (secs >= 60) strengths.push({ title: "You filled the time", detail: `You kept going for ${secs} seconds on a topic you'd never prepared.` });
  if (m && m.fillersPerMin !== null && m.fillersPerMin < 2) strengths.push({ title: "Clean delivery", detail: "Hardly any ums or uhs. You sounded composed." });
  if (m && m.wpm !== null && m.wpm >= 110 && m.wpm <= 175) strengths.push({ title: "A comfortable pace", detail: `At ${m.wpm} words a minute you were easy to follow.` });
  if (answered) strengths.push({ title: "You took the questions", detail: "You answered both audience questions instead of dodging them." });
  if (!strengths.length) strengths.push({ title: "You got up and spoke", detail: "Speaking on the spot is the hardest version of this. Every rep makes it easier." });

  if (secs < 60) improvements.push({ title: "Stretch it to a full minute", detail: `The talk ran ${secs} seconds before questions.`, tryInstead: "Use a simple shape: one point, one example, one line to close." });
  if (m && m.fillersPerMin !== null && m.fillersPerMin >= 4) improvements.push({ title: "Swap fillers for pauses", detail: `You used ${m.fillers} filler words (${m.fillersPerMin} a minute).`, tryInstead: "When you need a second, stop and breathe. The audience hears a pause as confidence." });
  if (m && m.longestPause > 3.5) improvements.push({ title: "Shorten the long pauses", detail: `Your longest pause mid-sentence was ${m.longestPause} seconds.`, tryInstead: "If you lose your thread, repeat your main point out loud. It buys time and sounds deliberate." });
  if (m && m.wpm !== null && m.wpm > 180) improvements.push({ title: "Slow down a little", detail: `You spoke at ${m.wpm} words a minute.`, tryInstead: "Pause at the end of each sentence." });
  if (!improvements.length) improvements.push({ title: "Try a harder topic", detail: "This went well. Run it again for a new random topic.", tryInstead: "Open with a one-sentence answer to the topic, then back it up." });

  const moments: CoachReport["moments"] = r.points
    .filter((p) => p.kind !== "tick" && p.said)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .sort((a, b) => a.t - b.t)
    .map((p) => ({
      at: Math.max(0, Math.round(p.t - 3)),
      quote: p.said,
      kind: p.delta > 0 ? "great" : "missed",
      comment: `${p.signals.map((s) => s.label).join(". ")}.`,
      better: p.delta > 0 ? "" : "Answer in one sentence first, then give one reason.",
    }));

  const headline =
    secs >= 60 && (!m || (m.fillersPerMin ?? 0) < 4)
      ? "A confident talk. You held the room."
      : secs < 40
        ? "A short talk. Next time, add one more example to fill the time."
        : "You got through it. A couple of tweaks will make it land.";
  return { source: "rules", headline, strengths: strengths.slice(0, 2), improvements: improvements.slice(0, 2), moments, nextStep: improvements[0].detail + " " + improvements[0].tryInstead };
}
