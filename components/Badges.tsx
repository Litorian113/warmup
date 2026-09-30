"use client";

import { useState } from "react";
import Emoji from "./Emoji";
import type { Badge, Earned } from "@/lib/badges";

/** The badge's picture, or its OpenMoji on a pastel disc until the picture exists. Locked badges are greyed out. */
export function BadgeArt({ badge, size = 88, locked = false }: { badge: Badge; size?: number; locked?: boolean }) {
  return (
    <span
      className={`badge-art${locked ? " is-locked" : ""}`}
      style={{ width: size, height: size, background: badge.image ? undefined : badge.tint }}
      aria-hidden="true"
    >
      {badge.image ? (
        <img src={badge.image} alt="" width={size} height={size} />
      ) : (
        <Emoji code={badge.emoji} size={Math.round(size * 0.62)} />
      )}
    </span>
  );
}

const FIRST = 6; // two rows of three before "Show all"

const earnedOn = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The badges, earned ones first. A few show, the rest unfold. Hover, focus or tap one for its card. */
export function BadgeShelf({ badges, earned }: { badges: Badge[]; earned: Earned }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const count = badges.filter((b) => earned.has(b.id)).length;
  const sorted = [...badges.filter((b) => earned.has(b.id)), ...badges.filter((b) => !earned.has(b.id))];
  const shown = all ? sorted : sorted.slice(0, FIRST);
  return (
    <section className="badges" aria-labelledby="badges-title">
      <div className="badges__head">
        <h3 id="badges-title" className="h3">
          Badges
        </h3>
        <span className="badges__count">
          {count} of {badges.length}
        </span>
      </div>
      <ul className="badges__grid">
        {shown.map((b) => {
          const got = earned.get(b.id);
          return (
            <li key={b.id} className={`badge-cell${picked === b.id ? " is-picked" : ""}`}>
              <button
                type="button"
                className={`badge${got ? "" : " is-locked"}`}
                aria-describedby={`badge-card-${b.id}`}
                aria-expanded={picked === b.id}
                onClick={() => setPicked(picked === b.id ? null : b.id)}
                onBlur={() => setPicked((p) => (p === b.id ? null : p))}
              >
                <BadgeArt badge={b} size={64} locked={!got} />
                <span className="badge__name">{b.name}</span>
              </button>
              <div id={`badge-card-${b.id}`} role="tooltip" className={`badge-card${got ? " is-earned" : ""}`} style={got ? { background: b.tint } : undefined}>
                <span className="badge-card__status">{got ? `Earned ${earnedOn(got.at)}` : "Locked"}</span>
                <span className="badge-card__name">{b.name}</span>
                <span className="badge-card__text">
                  {got ? "You got it: " : "How to earn it: "}
                  {b.description}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {badges.length > FIRST && (
        <button type="button" className="badges__more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${badges.length}`}
        </button>
      )}
    </section>
  );
}

/** "You earned a badge": shown on the report of the session that earned it, with a little confetti. */
export function BadgeCelebration({ badges }: { badges: Badge[] }) {
  if (!badges.length) return null;
  return (
    <section className="celebrate glass-card" aria-labelledby="celebrate-title">
      <div className="celebrate__confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <h2 id="celebrate-title" className="glass-card__title">
        {badges.length === 1 ? "New badge" : `${badges.length} new badges`}
      </h2>
      <ul className="celebrate__list">
        {badges.map((b) => (
          <li key={b.id} className="celebrate__badge">
            <BadgeArt badge={b} size={96} />
            <div>
              <p className="celebrate__name">{b.name}</p>
              <p className="small muted">{b.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
