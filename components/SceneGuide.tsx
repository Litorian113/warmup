import Emoji from "./Emoji";
import type { Guide, GuideTip } from "@/lib/guides";

const GROUPS: { key: keyof Guide; title: string; emoji: string; tint: string }[] = [
  { key: "openers", title: "Getting in", emoji: "1F44B", tint: "#dce8f8" },
  { key: "during", title: "Keeping it going", emoji: "1F4AC", tint: "#dcebe0" },
  { key: "exits", title: "Getting out", emoji: "1F6AA", tint: "#fae2d4" },
];

/** Scene-specific ways in, through and out of the conversation, as a row of cards you scroll sideways. */
export default function SceneGuide({ guide, title = "How to handle this one" }: { guide: Guide; title?: string }) {
  return (
    <section className="block guide" aria-labelledby="guide-title">
      <div className="block__head">
        <h2 id="guide-title" className="h2">
          {title}
        </h2>
        <p className="muted">Ways in, through and out of this conversation, each with a line to try. Scroll sideways for more.</p>
      </div>
      <ul className="guide__row" tabIndex={0} aria-label={title}>
        {GROUPS.flatMap((g) => guide[g.key].map((t) => <Tip key={`${g.key}-${t.title}`} tip={t} group={g} />))}
      </ul>
    </section>
  );
}

function Tip({ tip, group }: { tip: GuideTip; group: (typeof GROUPS)[number] }) {
  return (
    <li className="guide__card">
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
