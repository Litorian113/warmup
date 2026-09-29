"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sceneById } from "@/lib/scenarios";
import { listSessions, type SessionRecord } from "@/lib/store";
import { warmthColor } from "@/lib/warmth";

const when = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function RecentPractice() {
  const [list, setList] = useState<SessionRecord[] | null>(null);
  useEffect(() => setList(listSessions()), []);

  if (!list?.length) return null;
  return (
    <section id="history" className="wrap history" aria-labelledby="history-title">
      <div className="section-head">
        <h2 id="history-title" className="h2">
          Your practice
        </h2>
      </div>
      <ul className="history__list">
        {list.slice(0, 8).map((r) => {
          const scene = sceneById(r.sceneId);
          return (
            <li key={r.id}>
              <Link href={`/report/${r.id}`} className="history__item">
                <span className="temp-dot" style={{ background: warmthColor(r.finalWarmth) }} aria-hidden="true" />
                <span>
                  <span className="history__title">
                    {scene?.title ?? r.sceneId} with {r.personaName}
                  </span>
                  <br />
                  <span className="history__when">{when(r.createdAt)}</span>
                </span>
                <span className="history__warmth">
                  {scene?.kind === "talk" ? "Attention" : "Warmth"} {r.startWarmth} to {r.finalWarmth}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
