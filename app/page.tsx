import Link from "next/link";
import HeroDemo from "@/components/HeroDemo";
import RecentPractice from "@/components/RecentPractice";
import { LEVELS, SCENES, type Level, type Scene } from "@/lib/scenarios";
import { startingTemperature, warmthColor } from "@/lib/warmth";

const who = (s: Scene) => `with ${s.personas.map((p) => p.name).join(" or ")}`;

export default function Home() {
  const levels: Level[] = [1, 2, 3, 4, 5];
  return (
    <main>
      <section className="wrap hero">
        <div className="hero__copy">
          <h1 className="display">Practice the conversations you&rsquo;d rather avoid.</h1>
          <p className="lede">
            Talk out loud with AI people who react like real ones. Ask a good question and they warm up. Give one-word answers and they
            drift away. Afterwards, you get a replay of what worked and what to try next.
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
          <p className="lede">Start low. Each level adds a little more pressure, the way exposure practice works.</p>
        </div>
        <ol className="ladder">
          {levels.map((lvl) => (
            <li key={lvl} className="rung" style={{ "--lvl": lvl } as React.CSSProperties}>
              <div className="rung__head">
                <span className="rung__num" aria-label={`Level ${lvl}`}>
                  {lvl}
                </span>
                <span className="rung__name">{LEVELS[lvl].name}</span>
                <span className="rung__note">{LEVELS[lvl].note}</span>
              </div>
              {SCENES.filter((s) => s.level === lvl).map((s) => (
                <Link key={s.id} href={`/practice/${s.id}`} className="scene">
                  <span className="scene__title">{s.title}</span>
                  <span className="scene__who">{s.blurb}</span>
                  <span className="scene__meta">
                    <span>
                      {who(s)}, {s.minutes}
                    </span>
                    <span className="scene__temp">
                      <span className="temp-dot" style={{ background: warmthColor(s.profile.baseline) }} aria-hidden="true" />
                      {startingTemperature(s.profile.baseline)}
                    </span>
                  </span>
                </Link>
              ))}
            </li>
          ))}
        </ol>
      </section>

      <RecentPractice />
    </main>
  );
}
