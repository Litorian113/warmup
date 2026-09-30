import Emoji from "./Emoji";
import type { Guide, GuideTip } from "@/lib/guides";

const GROUPS: { key: keyof Guide; title: string; emoji: string }[] = [
  { key: "openers", title: "Getting in", emoji: "1F44B" },
  { key: "during", title: "Keeping it going", emoji: "1F4AC" },
  { key: "exits", title: "Getting out", emoji: "1F6AA" },
];

/** Scene-specific ways in, through and out of the conversation, each with a line you could say. */
export default function SceneGuide({ guide, title = "How to handle this one" }: { guide: Guide; title?: string }) {
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h2 id="guide-title" className="h2">
        {title}
      </h2>
      <div className="guide__grid">
        {GROUPS.map((g) => (
          <section key={g.key} className="guide__group glass-card" aria-label={g.title}>
            <h3 className="glass-card__title">
              <Emoji code={g.emoji} size={34} />
              {g.title}
            </h3>
            <ul className="guide__tips">
              {guide[g.key].map((t) => (
                <Tip key={t.title} tip={t} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function Tip({ tip }: { tip: GuideTip }) {
  return (
    <li className="guide__tip">
      <Emoji code={tip.emoji} size={40} className="guide__emoji" />
      <div className="guide__body">
        <p className="guide__title">{tip.title}</p>
        <p className="guide__detail">{tip.detail}</p>
        <p className="guide__line">
          <span className="guide__line-label">You could say</span>“{tip.line}”
        </p>
      </div>
    </li>
  );
}
