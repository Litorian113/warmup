// Badges, derived from the practice history in this browser. Each rule reads only what a
// SessionRecord saves. Earned badges are also remembered on their own, because the history keeps
// only the newest sessions and a badge shouldn't disappear with them.
import { FAREWELL, words } from "./engagement";
import { planRetake } from "./retake";
import { LEVELS, MOODS, SCENES, sceneById, type Scene } from "./scenarios";
import type { SessionRecord } from "./store";

export interface Badge {
  id: string;
  name: string;
  /** How you earn it, shown to the user. */
  description: string;
  kind: "scene" | "milestone" | "skill";
  /** OpenMoji code point shown until the badge has its own picture. */
  emoji: string;
  /** Background of the placeholder. */
  tint: string;
  /** The badge's picture (public/badges/<id>.png), once it exists. */
  image?: string;
}

/** Badge id → the session that first earned it, and when. */
export type Earned = Map<string, { recordId: string; at: number }>;

const MOOD_MIN = Object.fromEntries(MOODS.map((m) => [m.id, m.min]));
const conversation = (r: SessionRecord) => sceneById(r.sceneId)?.kind === "conversation";

/** The goals a session reached, merged the way the report shows them (coach goals count for conversations). */
export function goalsReached(r: SessionRecord, s: Scene): Record<string, boolean> {
  const done = { ...r.goals };
  if (s.kind === "conversation") for (const g of r.coach?.goals ?? []) if (g.done) done[g.id] = true;
  return done;
}

/** Their last line was a goodbye: saying it and then pressing End is still ending it yourself. */
const saidGoodbye = (r: SessionRecord) => FAREWELL.test([...r.lines].reverse().find((l) => l.who === "you")?.text ?? "");

/** The retake says something new, not the same words again. */
const reworded = (said: string, old: string) => words(said).join(" ") !== words(old).join(" ");

const allGoals = (r: SessionRecord, s: Scene) => {
  const done = goalsReached(r, s);
  return s.goals.every((g) => done[g.id]);
};

const SCENE_BADGES: Record<string, { name: string; description: string; emoji: string }> = {
  cafe: {
    name: "The Regular",
    description: "Order a drink, answer the small talk properly and ask something back, all in one visit to the café.",
    emoji: "1F950",
  },
  coworker: {
    name: "Break Room Pal",
    description: "Ask about their weekend, share something about yours and find one thing you have in common.",
    emoji: "1F369",
  },
  party: {
    name: "Party Pal",
    description: "Learn her name, find something you share and leave the conversation gracefully.",
    emoji: "1F973",
  },
  networking: {
    name: "Icebreaker",
    description: "Find out what he works on, get him to open up and leave with a way to follow up.",
    emoji: "1F6A2",
  },
  "first-date": {
    name: "Sparks Fly",
    description: "On the first date, follow up on something they said, tell a real story and find something you both love.",
    emoji: "2728",
  },
  "ask-out": {
    name: "Brave Heart",
    description: "Keep the chat going, find a shared interest and ask them out clearly, whatever they answer.",
    emoji: "1F49D",
  },
  stage: {
    name: "Mic Drop",
    description: "Talk for at least a minute on your random topic and answer both audience questions.",
    emoji: "1F399",
  },
};

interface Rule {
  badge: Badge;
  /** Earned by this one session. */
  one?: (r: SessionRecord) => boolean;
  /** Earned once these badges are all earned (milestones). */
  all?: string[];
}

const RULES: Rule[] = [
  ...SCENES.map((s): Rule => ({
    badge: { id: `scene-${s.id}`, kind: "scene", tint: LEVELS[s.level].tint, ...SCENE_BADGES[s.id] },
    one: (r) => r.sceneId === s.id && allGoals(r, s),
  })),
  {
    badge: {
      id: "base-camp",
      name: "Base Camp",
      kind: "milestone",
      emoji: "26FA",
      tint: "#e3edda",
      description: "Reach every goal in each of the first three levels: the café, the coffee machine and the party.",
    },
    all: SCENES.filter((s) => s.level <= 3).map((s) => `scene-${s.id}`),
  },
  {
    badge: {
      id: "summit",
      name: "Summit",
      kind: "milestone",
      emoji: "1F3D4",
      tint: "#f8edcf",
      description: "Reach every goal in all seven scenes, from ordering a coffee to speaking on the spot.",
    },
    all: SCENES.map((s) => `scene-${s.id}`),
  },
  {
    badge: {
      id: "thread-puller",
      name: "Thread Puller",
      kind: "skill",
      emoji: "1F9F5",
      tint: "#fae2d4",
      description: "Follow up on something they told you three times in one conversation.",
    },
    one: (r) => r.points.filter((p) => p.kind !== "tick" && p.signals.some((s) => s.label.startsWith("Followed up on"))).length >= 3,
  },
  {
    badge: {
      id: "sunshine",
      name: "Sunshine",
      kind: "skill",
      emoji: "1F31E",
      tint: "#fbe8c4",
      description: "End a conversation while they are truly enjoying it.",
    },
    one: (r) => conversation(r) && r.outcome !== "dropped" && r.finalWarmth >= MOOD_MIN.delighted,
  },
  {
    badge: {
      id: "classy-exit",
      name: "Classy Exit",
      kind: "skill",
      emoji: "1F3A9",
      tint: "#e8e2f5",
      description: "Say a warm goodbye and end the conversation yourself while they are still interested.",
    },
    one: (r) => conversation(r) && r.finalWarmth >= MOOD_MIN.interested && (r.outcome === "wrapped-up" || (r.outcome === "you-ended" && saidGoodbye(r))),
  },
  {
    badge: {
      id: "bounce-back",
      name: "Bounce Back",
      kind: "skill",
      emoji: "1FA83",
      tint: "#dce8f8",
      description: "Lose them for a moment, then win them back so they end at least as interested as they started.",
    },
    one: (r) =>
      conversation(r) &&
      r.points.length > 0 &&
      Math.min(...r.points.map((p) => p.value)) <= r.startWarmth - 15 &&
      r.finalWarmth >= r.startWarmth,
  },
  {
    badge: {
      id: "take-two",
      name: "Take Two",
      kind: "skill",
      emoji: "1F3AC",
      tint: "#dcebe0",
      description: "Retry a moment from your report and find a line that lands better than the first time.",
    },
    one: (r) =>
      Object.entries(r.retakes ?? {}).some(([i, res]) => {
        const plan = planRetake(r, Number(i));
        return plan !== null && reworded(res.said, plan.oldSaid) && res.delta - (plan.oldPoint?.delta ?? 0) > 2;
      }),
  },
];

export const BADGES: Badge[] = RULES.map((r) => r.badge);

const KEY = "warmup.badges.v1";

function remembered(): Earned {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(KEY) ?? "{}")));
  } catch {
    return new Map();
  }
}

/** Every badge earned so far, with the session that first earned it. Remembers new ones. */
export function earnedBadges(records: SessionRecord[]): Earned {
  const earned = remembered();
  const before = earned.size;
  // Oldest first, so each badge is credited to the session that earned it first.
  for (const r of [...records].sort((a, b) => a.createdAt - b.createdAt)) {
    for (const rule of RULES) {
      if (earned.has(rule.badge.id)) continue;
      if (rule.one?.(r) || (rule.all && rule.all.every((id) => earned.has(id))))
        earned.set(rule.badge.id, { recordId: r.id, at: r.createdAt });
    }
  }
  if (earned.size !== before) {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(earned)));
    } catch {
      // storage full or blocked: the badges are still derived from the history next time
    }
  }
  return earned;
}

/** The badges this session earned for the first time. */
export const badgesFrom = (recordId: string, earned: Earned) => BADGES.filter((b) => earned.get(b.id)?.recordId === recordId);
