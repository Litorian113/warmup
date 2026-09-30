"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeShelf } from "./Badges";
import Emoji from "./Emoji";
import { mmss } from "@/lib/metrics";
import { SCENES, sceneById } from "@/lib/scenarios";
import { BADGES, earnedBadges } from "@/lib/badges";
import { listSessions, type SessionRecord } from "@/lib/store";

const FIRST = 6; // sessions shown before "Show all"

const when = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

type Row = Pick<SessionRecord, "id" | "sceneId" | "personaName" | "createdAt" | "durationSec" | "startWarmth" | "finalWarmth">;

/** Shown until the first real session, so a new visitor sees what this list will hold. Never saved, and never
 *  counted towards badges. Each starts where the scene starts and links to the scene, not to a replay. */
const EXAMPLES: Row[] = [
  { sceneId: "cafe", personaName: "Jess", durationSec: 134, finalWarmth: 74 },
  { sceneId: "party", personaName: "Sam", durationSec: 221, finalWarmth: 66 },
  { sceneId: "coworker", personaName: "Marcus", durationSec: 186, finalWarmth: 49 },
  { sceneId: "stage", personaName: "Priya", durationSec: 152, finalWarmth: 71 },
].map((e) => ({ ...e, id: `example-${e.sceneId}`, createdAt: 0, startWarmth: sceneById(e.sceneId)?.profile.baseline ?? 50 }));

export default function RecentPractice() {
  const [list, setList] = useState<SessionRecord[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [all, setAll] = useState(false);
  useEffect(() => setList(listSessions()), []);

  if (!list) return null;
  const example = !list.length;
  const rows: Row[] = example ? EXAMPLES : list;
  const practiced = SCENES.filter((s) => rows.some((r) => r.sceneId === s.id));
  const best = Math.max(...rows.map((r) => r.finalWarmth - r.startWarmth));
  const shownList = rows.filter((r) => filter === "all" || r.sceneId === filter);
  const shown = all ? shownList : shownList.slice(0, FIRST);

  return (
    <section id="history" className="wrap history" aria-labelledby="history-title">
      <div className="history__intro">
        <h2 id="history-title" className="display history__heading">
          Your practice
        </h2>
        <p className="lede">
          {example
            ? "Your conversations will show up here, each with a replay of what worked. Until you’ve had one, these examples show what to expect."
            : "Every conversation you’ve had, with its replay. Open one to see what worked, or try a moment again."}
        </p>
        <dl className="history__stats">
          <div>
            <dt>Sessions</dt>
            <dd>{rows.length}</dd>
          </div>
          <div>
            <dt>Scenes tried</dt>
            <dd>
              {practiced.length}
              <span> of {SCENES.length}</span>
            </dd>
          </div>
          {best > 0 && (
            <div>
              <dt>Best gain</dt>
              <dd>{signed(best)}</dd>
            </div>
          )}
        </dl>
        <BadgeShelf badges={BADGES} earned={earnedBadges(list)} />
      </div>

      <div className="history__main">
        {!example && practiced.length > 1 && (
          <label className="history__filter">
            <span className="sr-only">Show sessions from</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setAll(false);
              }}
            >
              <option value="all">All scenes</option>
              {practiced.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <ul className="history__list">
          {shown.map((r) => {
            const scene = sceneById(r.sceneId);
            const delta = r.finalWarmth - r.startWarmth;
            const tone = delta >= 3 ? "up" : delta <= -3 ? "down" : "flat";
            return (
              <li key={r.id}>
                <Link href={example ? `/practice/${r.sceneId}` : `/report/${r.id}`} className={`history__item${example ? " is-example" : ""}`}>
                  <span className="history__tile" aria-hidden="true">
                    {scene && <Emoji code={scene.emoji} size={52} />}
                  </span>
                  <span className="history__text">
                    <span className="history__title">
                      {scene?.title ?? r.sceneId} with {r.personaName}
                    </span>
                    <span className="history__when">
                      {example ? "Example" : when(r.createdAt)} · {mmss(r.durationSec)}
                    </span>
                  </span>
                  <span className="history__result">
                    <span className={`history__pill history__pill--${tone}`}>
                      <Trend tone={tone} />
                      {scene?.kind === "talk" ? "Attention" : "Interest"} {r.startWarmth} → {r.finalWarmth}
                      <span className="sr-only"> ({signed(delta)})</span>
                    </span>
                    <span className="history__open">{example ? "Try this scene" : "View replay"}</span>
                  </span>
                  <svg className="history__chev" viewBox="0 0 12 20" aria-hidden="true">
                    <path d="M3 3 L9 10 L3 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>

        {shownList.length > shown.length && (
          <button className="btn btn--ghost btn--quiet history__more" onClick={() => setAll(true)}>
            Show all {shownList.length}
          </button>
        )}
      </div>
    </section>
  );
}

/** A small arrow for how their interest moved: up, down or flat. */
function Trend({ tone }: { tone: "up" | "down" | "flat" }) {
  const d = tone === "up" ? "M3 13 L8 8 L11 11 L17 5 M12 5 H17 V10" : tone === "down" ? "M3 7 L8 12 L11 9 L17 15 M12 15 H17 V10" : "M3 10 H17 M13 6 L17 10 L13 14";
  return (
    <svg className="history__trend" viewBox="0 0 20 20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
