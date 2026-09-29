"use client";

import { useEffect, useState } from "react";
import WarmthMeter from "./WarmthMeter";
import { moodFor } from "@/lib/scenarios";
import { warmthColor } from "@/lib/warmth";

type Step =
  | { who: "them" | "you"; text: string }
  | { who: "signal"; label: string; delta: number; warmth: number };

// One orchestrated moment: a short exchange where the room cools, then warms.
const STEPS: Step[] = [
  { who: "them", text: "I edit podcasts, mostly true crime. It's less grim than it sounds." },
  { who: "you", text: "Cool." },
  { who: "signal", label: "Very short answer", delta: -8, warmth: 38 },
  { who: "you", text: "Wait, true crime? How do you edit that stuff without getting paranoid?" },
  { who: "signal", label: "Followed up on “crime”", delta: 11, warmth: 71 },
  { who: "them", text: "Honestly? I sleep with the lights on now. Want to hear the worst one?" },
];

export default function HeroDemo() {
  const [step, setStep] = useState(STEPS.length - 1);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimate(true);
    setStep(0);
    let i = 0;
    const id = setInterval(() => {
      i = i + 1 > STEPS.length + 2 ? 0 : i + 1; // hold on the last frame, then replay
      setStep(Math.min(i, STEPS.length - 1));
    }, 1900);
    return () => clearInterval(id);
  }, []);

  const shown = STEPS.slice(0, step + 1);
  const lastSignal = [...shown].reverse().find((s) => s.who === "signal") as Extract<Step, { who: "signal" }> | undefined;
  const warmth = lastSignal?.warmth ?? 50;

  return (
    <figure className="demo" style={{ "--room": warmthColor(warmth) } as React.CSSProperties} aria-label="Example: the other person warms up when you follow up on what they said">
      <div className="demo__who">
        <span className="demo__avatar" aria-hidden="true">
          S
        </span>
        <span>
          <strong>Sam</strong>, at a house party
          <br />
          <span className="demo__mood">Sam {moodFor(warmth).label}</span>
        </span>
      </div>
      {STEPS.map((s, i) =>
        s.who === "signal" ? (
          <span key={i} className={`demo__signal chip ${s.delta > 0 ? "chip--up" : "chip--down"}${!animate || i <= step ? " is-in" : ""}`}>
            <span className="chip__delta">{s.delta > 0 ? `+${s.delta}` : `−${-s.delta}`}</span>
            {s.label}
          </span>
        ) : (
          <p key={i} className={`demo__line demo__line--${s.who}${!animate || i <= step ? " is-in" : ""}`}>
            {s.text}
          </p>
        ),
      )}
      <div className="demo__meter">
        <WarmthMeter value={warmth} label="Sam's warmth" />
      </div>
    </figure>
  );
}
