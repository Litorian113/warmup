import Link from "next/link";
import Emoji from "@/components/Emoji";
import HeroDemo from "@/components/HeroDemo";
import RecentPractice from "@/components/RecentPractice";
import { LEVELS, SCENES, type Level } from "@/lib/scenarios";

export default function Home() {
  const levels: Level[] = [1, 2, 3, 4, 5];
  return (
    <>
      <main>
        <section className="wrap hero">
          <div className="hero__copy">
            <h1 className="display">Practice the conversations you&rsquo;d rather avoid.</h1>
            <p className="lede">
              Talk out loud with AI people who react like real ones. Ask a good question and they warm up. Give one-word answers and they
              drift away. Afterwards, replay it and see what to try next.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--big" href="/practice/cafe">
                Start with a coffee order
              </Link>
              <Link className="btn btn--ghost btn--big" href="#scenes">
                Choose a scene
              </Link>
            </div>
            <p className="hero__note">Uses your microphone. Headphones are optional.</p>
          </div>
          <HeroDemo />
        </section>

        <section id="scenes" className="wrap" aria-labelledby="scenes-title">
          <div className="section-head">
            <h2 id="scenes-title" className="h2">
              Pick a rung
            </h2>
            <p className="lede">Start low. Each level adds a little more pressure.</p>
          </div>
          <ol className="ladder">
            {levels.map((lvl) => (
              <li key={lvl} className="rung" style={{ "--lvl": lvl } as React.CSSProperties}>
                <div className="rung__head">
                  <span className="rung__num" aria-label={`Level ${lvl}`}>
                    {lvl}
                  </span>
                  <span className="rung__name">{LEVELS[lvl].name}</span>
                </div>
                {SCENES.filter((s) => s.level === lvl).map((s) => (
                  <Link key={s.id} href={`/practice/${s.id}`} className="scene">
                    <Emoji code={s.emoji} size={36} className="scene__emoji" />
                    <span className="scene__title">{s.title}</span>
                    <span className="scene__who">{s.blurb}</span>
                  </Link>
                ))}
              </li>
            ))}
          </ol>
        </section>

        <RecentPractice />
      </main>
      <footer className="site-footer">
        <div className="wrap site-footer__inner">
          <p>Built on AssemblyAI&apos;s Voice Agent API, Universal-3.5 Pro and LLM Gateway.</p>
          <p>Your practice history stays in this browser.</p>
          <p>
            Emoji by{" "}
            <a href="https://openmoji.org" target="_blank" rel="noreferrer">
              OpenMoji
            </a>
            , licensed{" "}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
              CC BY-SA 4.0
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  );
}
