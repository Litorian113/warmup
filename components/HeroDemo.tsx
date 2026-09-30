"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Emoji from "./Emoji";
import WarmthMeter from "./WarmthMeter";
import { moodFor } from "@/lib/scenarios";
import { warmthColor } from "@/lib/warmth";

type Step = { who: "them" | "you"; text: string } | { who: "signal"; label: string; delta: number; warmth: number };

// One orchestrated moment at the café: a short exchange where Jess cools, then warms.
const START = 46;
const STEPS: Step[] = [
  { who: "them", text: "I'm training for my first half marathon. My knees are not thrilled." },
  { who: "you", text: "Cool." },
  { who: "signal", label: "Very short answer", delta: -8, warmth: 38 },
  { who: "you", text: "Wait, a half marathon? What made you sign up for that?" },
  { who: "signal", label: "Followed up on “marathon”", delta: 11, warmth: 71 },
  { who: "them", text: "Honestly? I lost a bet. Want to hear the ridiculous part?" },
];

const PORTRAIT = "/personas/Jess-Persona.png";

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
  const warmth = lastSignal?.warmth ?? START;
  const isIn = (i: number) => (!animate || i <= step ? " is-in" : "");

  return (
    <figure
      className="demo"
      style={{ "--room": warmthColor(warmth) } as React.CSSProperties}
      aria-label="Example: Jess warms up when you follow up on what she said"
    >
      <div className="demo__head">
        <span className="demo__portrait" aria-hidden="true">
          <Image src={PORTRAIT} alt="" width={1200} height={1200} sizes="140px" />
        </span>
        <div className="demo__status">
          <p className="demo__name">
            <strong>Jess</strong>, at the café
          </p>
          <p className="demo__mood">Jess {moodFor(warmth).label}</p>
          <WarmthMeter value={warmth} label="Warmth" />
        </div>
        <span className="demo__scene">
          <Emoji code="2615" size={20} />
          Café
        </span>
      </div>

      <div className="demo__chat">
        {STEPS.map((s, i) =>
          s.who === "signal" ? (
            <span key={i} className={`demo__signal chip ${s.delta > 0 ? "chip--up" : "chip--down"}${isIn(i)}`}>
              <span className="chip__delta">{s.delta > 0 ? `+${s.delta}` : `−${-s.delta}`}</span>
              {s.label}
            </span>
          ) : s.who === "them" ? (
            <div key={i} className={`demo__row${isIn(i)}`}>
              <span className="avatar avatar--portrait demo__face" aria-hidden="true">
                <Image src={PORTRAIT} alt="" width={1200} height={1200} sizes="48px" />
              </span>
              <p className="demo__line demo__line--them">{s.text}</p>
            </div>
          ) : (
            <p key={i} className={`demo__line demo__line--you${isIn(i)}`}>
              {s.text}
            </p>
          ),
        )}
      </div>

      <div className="demo__turn" aria-hidden="true">
        <svg className="demo__wave" viewBox="0 0 28 20">
          {[4, 10, 16, 8, 12].map((h, k) => (
            <rect key={k} x={2 + k * 5.5} y={10 - h / 2} width="3" height={h} rx="1.5" />
          ))}
        </svg>
        <span>Your turn…</span>
        <span className="demo__send">
          <svg viewBox="0 0 20 20">
            <path
              d="M5 15 L15 5 M8 5 H15 V12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </figure>
  );
}
