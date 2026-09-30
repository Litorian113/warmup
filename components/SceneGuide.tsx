import Emoji from "./Emoji";
import type { Guide, GuideTip } from "@/lib/guides";

const GROUPS: { key: keyof Guide; title: string; emoji: string; tint: string }[] = [
  { key: "openers", title: "Getting in", emoji: "1F44B", tint: "#dce8f8" },
  { key: "during", title: "Keeping it going", emoji: "1F4AC", tint: "#dcebe0" },
  { key: "exits", title: "Getting out", emoji: "1F6AA", tint: "#fae2d4" },
];

/**
 * Scene-specific ways in, through and out of the conversation, as a row of cards you scroll sideways.
 * With `used`, each card is marked: a green check for moves you used, an amber marker for the rest,
 * which come first.
 */
export default function SceneGuide({ guide, used, title = "How to handle this one" }: { guide: Guide; used?: Set<string>; title?: string }) {
  const cards = GROUPS.flatMap((g) => guide[g.key].map((tip) => ({ tip, group: g, done: used?.has(tip.title) })));
  if (used) cards.sort((a, b) => Number(a.done) - Number(b.done));
  const open = cards.filter((c) => !c.done).length;
  return (
    <section className="block guide" aria-labelledby="guide-title">
      <div className="block__head">
        <h2 id="guide-title" className="h2">
          {title}
        </h2>
        <p className="muted">
          {!used
            ? "Ways in, through and out of this conversation, each with a line to try."
            : open === 0
              ? `You used all ${cards.length} of these moves.`
              : `You used ${cards.length - open} of these ${cards.length} moves. ${open === 1 ? "The marked one is" : `The ${open} marked ones are`} worth trying on your next go.`}{" "}
          Scroll sideways for more.
        </p>
      </div>
      <ul className="guide__row" tabIndex={0} aria-label={title}>
        {cards.map(({ tip, group, done }) => (
          <Tip key={`${group.key}-${tip.title}`} tip={tip} group={group} done={used ? !!done : undefined} />
        ))}
      </ul>
    </section>
  );
}

function Tip({ tip, group, done }: { tip: GuideTip; group: (typeof GROUPS)[number]; done?: boolean }) {
  return (
    <li className={`guide__card${done ? " is-used" : ""}`}>
      {done !== undefined && (
        <span className={`guide__mark guide__mark--${done ? "used" : "open"}`} title={done ? "You did this" : "Try this next time"}>
          {done ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3.5v5.5M8 12v.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          )}
          <span className="sr-only">{done ? "You did this. " : "Not tried yet. "}</span>
        </span>
      )}
      <span className="guide__group" style={{ background: group.tint }}>
        <Emoji code={group.emoji} size={18} />
        {group.title}
      </span>
      <Emoji code={tip.emoji} size={52} className="guide__emoji" />
      <p className="guide__title">{tip.title}</p>
      <p className="guide__detail">{tip.detail}</p>
      <p className="guide__line">
        <span className="guide__line-label">You could say</span>“{tip.line}”
      </p>
    </li>
  );
}
