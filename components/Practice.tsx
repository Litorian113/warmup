"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import GoalList from "./GoalList";
import WarmthMeter from "./WarmthMeter";
import { Conversation, TALK_SECONDS, type LiveState } from "@/lib/conversation";
import { mmss } from "@/lib/metrics";
import { planRetake, type RetakePlan } from "@/lib/retake";
import { sceneById, type Scene } from "@/lib/scenarios";
import { getSession } from "@/lib/store";
import { startingTemperature, warmthColor } from "@/lib/warmth";

const noSub = () => () => {};
const noSnap = () => null;

export default function Practice({ sceneId }: { sceneId: string }) {
  const scene = sceneById(sceneId)!;
  const router = useRouter();
  const [personaIdx, setPersonaIdx] = useState(0);
  const [hints, setHints] = useState(scene.level <= 2);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [retake, setRetake] = useState<RetakePlan | null>(null);
  const state = useSyncExternalStore(conv?.subscribe ?? noSub, conv?.getSnapshot ?? noSnap, noSnap);

  // ?retake=<sessionId>.<momentIndex> replays one moment of an earlier conversation
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("retake");
    if (!q) return;
    const [rid, mi] = q.split(".");
    const rec = getSession(rid);
    const plan = rec && rec.sceneId === scene.id ? planRetake(rec, Number(mi)) : null;
    if (!plan || !rec) return;
    setRetake(plan);
    setPersonaIdx(Math.max(0, scene.personas.findIndex((p) => p.name === rec.personaName)));
  }, [scene]);

  useEffect(() => {
    if (state?.status === "ended" && state.recordId)
      router.push(retake ? `/report/${state.recordId}#moment-${retake.momentIndex}` : `/report/${state.recordId}`, { scroll: !retake });
  }, [state?.status, state?.recordId, router, retake]);

  // Leaving the page mid-session ends it cleanly (and saves what happened).
  useEffect(
    () => () => {
      if (conv && (conv.state.status === "live" || conv.state.status === "connecting")) void conv.end();
    },
    [conv],
  );

  const start = () => {
    const c = new Conversation(scene, scene.personas[personaIdx], retake);
    setConv(c);
    void c.start();
  };

  if ((!state || state.status === "idle" || state.status === "connecting" || state.status === "error") && retake) {
    return (
      <RetakeBriefing
        scene={scene}
        plan={retake}
        personaName={scene.personas[personaIdx].name}
        onStart={start}
        connecting={state?.status === "connecting"}
        error={state?.status === "error" ? state.error : null}
      />
    );
  }
  if (!state || state.status === "idle" || state.status === "connecting" || state.status === "error") {
    return (
      <Briefing
        scene={scene}
        personaIdx={personaIdx}
        setPersonaIdx={setPersonaIdx}
        hints={hints}
        setHints={setHints}
        onStart={start}
        connecting={state?.status === "connecting"}
        error={state?.status === "error" ? state.error : null}
      />
    );
  }
  return <Room conv={conv!} state={state} hints={hints} setHints={setHints} />;
}

function Briefing(props: {
  scene: Scene;
  personaIdx: number;
  setPersonaIdx: (i: number) => void;
  hints: boolean;
  setHints: (v: boolean) => void;
  onStart: () => void;
  connecting: boolean;
  error: string | null;
}) {
  const { scene, personaIdx } = props;
  const p = scene.personas[personaIdx];
  return (
    <div className="wrap">
      <Link href="/#scenes" className="link-back">
        ← All scenes
      </Link>
      <div className="brief">
        <div className="brief__main">
          <p className="muted">
            Level {scene.level}, {scene.minutes}
          </p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", maxWidth: "18ch" }}>
            {scene.title}
          </h1>
          <p className="lede direction">{scene.setting}</p>

          <div className="brief__block">
            <h2 className="brief__label">{scene.kind === "talk" ? "Your host" : "Who you're talking to"}</h2>
            {scene.personas.length > 1 ? (
              <fieldset className="choice" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="sr-only">Choose who you talk to</legend>
                {scene.personas.map((q, i) => (
                  <label key={q.name} className="choice__opt">
                    <input type="radio" name="persona" checked={i === personaIdx} onChange={() => props.setPersonaIdx(i)} />
                    <span className="choice__name">{q.name}</span>
                    <span className="choice__desc">
                      {q.pronouns}. {q.intro}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p>
                <strong>{p.name}</strong> ({p.pronouns}). {p.intro}
              </p>
            )}
            <p className="small muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="temp-dot" style={{ background: warmthColor(scene.profile.baseline) }} aria-hidden="true" />
              {startingTemperature(scene.profile.baseline)}.{" "}
              {scene.kind === "talk"
                ? "The audience's attention drops during long silences."
                : `${p.name} warms up when you're curious and cools down when you're not.`}
            </p>
          </div>

          <div className="brief__block">
            <h2 className="brief__label">Your goals</h2>
            <GoalList scene={scene} done={{}} />
          </div>

          <div className="brief__block">
            <h2 className="brief__label">Good to know</h2>
            <ul className="tips">
              {scene.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="brief__panel" aria-label="Start">
          <h2 className="h3">{scene.kind === "talk" ? "You'll get a random topic" : `${p.name} speaks first`}</h2>
          <p className="muted">
            {scene.kind === "talk"
              ? `Talk for about ${TALK_SECONDS} seconds, then answer two questions. Press "I'm done" when you finish early.`
              : "Talk the way you would in real life. There's no button to hold: just speak, and pause when you're done."}
          </p>
          {scene.kind === "conversation" && (
            <label className="toggle">
              <input type="checkbox" checked={props.hints} onChange={(e) => props.setHints(e.target.checked)} />
              Show a hint for what to say next
            </label>
          )}
          {props.error && (
            <p className="notice" role="alert">
              {props.error}
            </p>
          )}
          <button className="btn btn--big" onClick={props.onStart} disabled={props.connecting}>
            {props.connecting ? "Connecting…" : "Start talking"}
          </button>
          <p className="small muted">
            {props.connecting
              ? "Allow the microphone if your browser asks."
              : "Uses your microphone. The conversation is recorded so you can replay it in your report."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function RetakeBriefing(props: { scene: Scene; plan: RetakePlan; personaName: string; onStart: () => void; connecting: boolean; error: string | null }) {
  const { scene, plan, personaName } = props;
  return (
    <div className="wrap">
      <Link href={`/report/${plan.recordId}`} className="link-back">
        ← Back to your replay
      </Link>
      <div className="brief">
        <div className="brief__main">
          <p className="muted">
            {scene.title} with {personaName}
          </p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", maxWidth: "18ch" }}>
            Try this moment again
          </h1>
          <p className="lede">
            {personaName} will say the same line again, remembering everything that came before it. Answer it a new way, hear the reaction, and see
            how it compares.
          </p>
          <div className="brief__block">
            <h2 className="brief__label">{personaName} says</h2>
            <p className="caption caption--them" style={{ fontSize: "1.4rem" }}>
              “{plan.themLine}”
            </p>
          </div>
          <div className="brief__block">
            <h2 className="brief__label">Last time you said</h2>
            <p className="muted">“{plan.oldSaid}”</p>
            {plan.comment && <p>{plan.comment}</p>}
            {plan.better && (
              <p className="note__try">
                <span className="note__try-label">One idea</span>
                {plan.better}
              </p>
            )}
          </div>
        </div>
        <aside className="brief__panel" aria-label="Start">
          <h2 className="h3">One exchange, then back to your replay</h2>
          <p className="muted">Say your new version when {personaName} finishes. The retake ends after {personaName} reacts.</p>
          {props.error && (
            <p className="notice" role="alert">
              {props.error}
            </p>
          )}
          <button className="btn btn--big" onClick={props.onStart} disabled={props.connecting}>
            {props.connecting ? "Connecting…" : "Start the retake"}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Room({ conv, state, hints, setHints }: { conv: Conversation; state: LiveState; hints: boolean; setHints: (v: boolean) => void }) {
  const { scene, persona } = conv;
  const orbRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLSpanElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Audio levels drive the orb and mic dot every frame without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const { you, them } = conv.levels();
      orbRef.current?.style.setProperty("--lvl", Math.min(1, them * 5).toFixed(3));
      micRef.current?.style.setProperty("--mic", Math.min(1, you * 4).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [conv]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.lines]);

  const talk = scene.kind === "talk";
  const talkView = talk && state.phase === "talk" && state.talkLeft !== null;
  const lastThem = [...state.lines].reverse().find((l) => l.who === "them");
  const lastYou = [...state.lines].reverse().find((l) => l.who === "you");
  const youAfterThem = lastYou && lastThem ? state.lines.indexOf(lastYou) > state.lines.indexOf(lastThem) : !!lastYou;
  const ending = state.status === "ending";
  const meterLabel = talk ? "Audience attention" : `${persona.name}'s warmth`;

  const statusText = ending
    ? "Wrapping up and saving your session…"
    : state.speaking === "you"
      ? "Listening…"
      : state.thinking
        ? `${persona.name} is thinking…`
        : state.speaking === "them"
          ? ""
          : talkView
            ? state.talkLeft === TALK_SECONDS
              ? "Start whenever you're ready."
              : "Keep going, or press “I'm done”."
            : lastThem
              ? "Your turn. Take your time."
              : "";

  return (
    <div
      className="room"
      style={{ "--room": warmthColor(state.warmth), "--warm-c": (state.warmth / 100).toFixed(2) } as React.CSSProperties}
    >
      <div className="wrap room__bar">
        <div className="room__title">
          <span className="room__scene">
            {scene.title} with {persona.name}
          </span>
          <span className="room__time" aria-label="Time elapsed">
            {mmss(state.elapsed)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!talk && (
            <button className="btn btn--ghost btn--quiet" onClick={() => setHints(!hints)} aria-pressed={hints}>
              {hints ? "Hide hints" : "Show hints"}
            </button>
          )}
          <button className="btn btn--quiet" onClick={() => void conv.end()} disabled={ending}>
            {talk ? "End session" : "End conversation"}
          </button>
        </div>
      </div>

      <div className="wrap room__grid">
        <div className="stage">
          {talkView ? (
            <>
              <p className="muted">Your topic</p>
              <p className="topic">{state.topic}</p>
              <Countdown left={state.talkLeft!} />
              <div className="transcript-live" aria-live="off">
                {state.lines
                  .filter((l) => l.who === "you")
                  .slice(-6)
                  .map((l) => (
                    <span key={l.id}>{l.text} </span>
                  ))}
              </div>
              <button className="btn" onClick={() => conv.finishTalk()} disabled={state.talkLeft === TALK_SECONDS}>
                I&rsquo;m done, take questions
              </button>
            </>
          ) : (
            <>
              <div className="orb" ref={orbRef} aria-hidden="true">
                <div className="orb__halo" />
                <div className="orb__core">{persona.name[0]}</div>
              </div>
              <p className="stage__mood">
                {talk
                  ? state.phase === "qa"
                    ? `Question ${Math.min(2, state.answers + 1)} of 2`
                    : "Introducing your topic"
                  : `${persona.name} ${state.mood.label}`}
              </p>
              <div className="captions" aria-live="polite">
                {lastThem && (
                  <p className="caption caption--them">
                    <span className="caption__who">{persona.name}</span>
                    {lastThem.text || "…"}
                  </p>
                )}
                {lastYou && youAfterThem && (
                  <p className={`caption caption--you${lastYou.final ? "" : " is-partial"}`}>
                    <span className="caption__who">You</span>
                    {lastYou.text}
                  </p>
                )}
              </div>
            </>
          )}
          <p className="status-line" role="status">
            {state.speaking === "you" && !ending ? (
              <span className="listening">
                <span className="listening__dot" ref={micRef} />
                Listening…
              </span>
            ) : (
              statusText
            )}
          </p>
        </div>

        <aside className="side" aria-label="How it's going">
          <div className="panel">
            <WarmthMeter value={state.warmth} label={meterLabel} note={talk ? undefined : state.mood.label.replace(/^is |^seems /, "")} />
            {talk && state.phase === "talk" && (
              <p className="small muted">Attention dips during silences longer than 3 seconds and recovers while you speak.</p>
            )}
            <div className="feed" aria-live="polite" hidden={!state.feed}>
              {state.feed?.signals.map((s, i) => (
                <span key={`${state.feed!.id}-${i}`} className={`chip ${s.delta > 0 ? "chip--up" : "chip--down"}`}>
                  <span className="chip__delta">{s.delta > 0 ? `+${s.delta}` : `−${-s.delta}`}</span>
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {hints && !talk && state.tip && state.speaking !== "them" && (
            <div className="panel">
              <p className="tip">
                <span className="tip__label">Try this</span>
                {state.tip}
              </p>
            </div>
          )}

          <div className="panel">
            <h2 className="panel__title">Goals</h2>
            <GoalList scene={scene} done={state.goals} />
          </div>

          <div className="panel">
            <h2 className="panel__title">Transcript</h2>
            <div className="log" ref={logRef}>
              {state.lines.length === 0 && <p className="muted small">The conversation shows up here as you talk.</p>}
              {mergeLines(state.lines).map((l) => (
                <p key={l.id} className="log__line">
                  <b>{l.who === "you" ? "You" : persona.name}:</b> {l.text}
                  {l.interrupted ? " (cut off)" : ""}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Joins consecutive fragments from the same speaker into one transcript line. */
function mergeLines(lines: LiveState["lines"]) {
  const out: LiveState["lines"] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && prev.who === l.who && l.who === "you") out[out.length - 1] = { ...prev, text: `${prev.text} ${l.text}`, final: l.final };
    else out.push(l);
  }
  return out;
}

function Countdown({ left }: { left: number }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const frac = left / TALK_SECONDS;
  return (
    <div className="countdown" role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--rule)" strokeWidth="6" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span className="countdown__num">{left}</span>
    </div>
  );
}
