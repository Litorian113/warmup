import Link from "next/link";
import { Blob, Bubbles, Cloud, Cup, Flag, Plant, Plants, Sparks } from "@/components/Decor";
import Emoji from "@/components/Emoji";
import HeroDemo from "@/components/HeroDemo";
import RecentPractice from "@/components/RecentPractice";
import { LEVELS, SCENES, type Level } from "@/lib/scenarios";

// Each step of the ladder has its level's pastel and a little prop sitting on top of it.
const PROPS: Record<Level, (p: { className?: string }) => React.ReactElement> = { 1: Cup, 2: Plant, 3: Bubbles, 4: Plants, 5: Flag };

export default function Home() {
  const levels: Level[] = [1, 2, 3, 4, 5];
  return (
    <>
      <main className="home">
        <Cloud className="decor--cloud decor--cloud-a" />
        <Cloud className="decor--cloud decor--cloud-b" />
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
            <p className="hero__note">
              <Emoji code="1F399" size={22} />
              Uses your microphone. Headphones are optional.
            </p>
          </div>
          <div className="hero__art">
            <Blob className="hero__blob hero__blob--peach" shape="a" color="#fbe3d3" />
            <Blob className="hero__blob hero__blob--blue" shape="b" color="#dbe6f7" />
            <Blob className="hero__blob hero__blob--lilac" shape="c" color="#e9e2f6" />
            <Sparks className="hero__sparks hero__sparks--a" />
            <Sparks className="hero__sparks hero__sparks--b" />
            <Plant className="hero__plant" />
            <Cup className="hero__cup" />
            <HeroDemo />
          </div>
        </section>

        <section id="scenes" className="scenes" aria-labelledby="scenes-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="scenes-title" className="display scenes__title">
                Pick a level
              </h2>
              <p className="lede">Start low. Each level adds a little more pressure.</p>
            </div>
            <ol className="ladder">
              {levels.map((lvl) => {
                const { tint } = LEVELS[lvl];
                const Prop = PROPS[lvl];
                const prev = lvl > 1 ? LEVELS[(lvl - 1) as Level].tint : tint;
                return (
                  <li key={lvl} className="rung" style={{ "--lvl": lvl, "--tint": tint, "--prev": prev } as React.CSSProperties}>
                    <Prop className={`rung__prop rung__prop--${lvl}`} />
                    <div className="rung__head">
                      <span className="rung__num" aria-label={`Level ${lvl}`}>
                        {lvl}
                      </span>
                      <span className="rung__name">{LEVELS[lvl].name}</span>
                    </div>
                    {SCENES.filter((s) => s.level === lvl).map((s) => (
                      <Link key={s.id} href={`/practice/${s.id}`} className="scene">
                        <span className="scene__title">{s.title}</span>
                        <span className="scene__who">{s.blurb}</span>
                      </Link>
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
          {/* hills and plants that close the ladder; the top is transparent, the bottom is the ground */}
          <img className="divider" src="/backdrops/section-divider-svg.svg" alt="" width={1672} height={482} aria-hidden="true" />
        </section>

        <div className="ground">
          <RecentPractice />
        </div>
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
        {/* hills and plants that close the page */}
        <img className="footer-divider" src="/backdrops/Bottom-Final-Divider.svg" alt="" width={2169} height={449} aria-hidden="true" />
      </footer>
    </>
  );
}
