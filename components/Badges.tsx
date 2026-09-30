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

/** Every badge: earned ones in color, the rest greyed out. Tap or focus one to see how you earn it. */
export function BadgeShelf({ badges, earned }: { badges: Badge[]; earned: Earned }) {
  const [picked, setPicked] = useState<string | null>(null);
  const count = badges.filter((b) => earned.has(b.id)).length;
  const shown = badges.find((b) => b.id === picked);
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
        {badges.map((b) => {
          const got = earned.has(b.id);
          return (
            <li key={b.id}>
              <button
                type="button"
                className={`badge${got ? "" : " is-locked"}${picked === b.id ? " is-picked" : ""}`}
                aria-pressed={picked === b.id}
                onClick={() => setPicked(picked === b.id ? null : b.id)}
                onFocus={() => setPicked(b.id)}
              >
                <BadgeArt badge={b} size={64} locked={!got} />
                <span className="badge__name">{b.name}</span>
                <span className="sr-only">{got ? ", earned" : ", not earned yet"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="badges__detail small" aria-live="polite">
        {shown ? (
          <>
            <b>{shown.name}</b> {earned.has(shown.id) ? "Earned: " : "To earn it: "}
            {shown.description}
          </>
        ) : (
          "Tap a badge to see how you earn it."
        )}
      </p>
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
