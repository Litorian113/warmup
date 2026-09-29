"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import GoalList from "./GoalList";
import WarmthChart from "./WarmthChart";
import { outcomeText, rulesCoach } from "@/lib/coach";
import { isFiller, mmss } from "@/lib/metrics";
import { fetchCoach, runAnalysis } from "@/lib/report";
import { compareRetake, planRetake } from "@/lib/retake";
import { SCENES, sceneById, type Scene } from "@/lib/scenarios";
import { getSession, updateSession, type Metrics, type SessionRecord } from "@/lib/store";

type Status = "good" | "meh" | "bad";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function Report({ id }: { id: string }) {
  const [rec, setRec] = useState<SessionRecord | null | undefined>(undefined);
  const [phase, setPhase] = useState<"idle" | "transcribing" | "coaching" | "done">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [coachNotice, setCoachNotice] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const initial = getSession(id);
    setRec(initial);
    if (!initial) return;
    const ctrl = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const coach = async (r: SessionRecord) => {
      if (r.coach?.source === "llm") return setPhase("done");
      setPhase("coaching");
      const res = await fetchCoach(r, ctrl.signal).catch((e) => ({ error: errMsg(e), report: undefined, retryAfter: undefined }));
      if (ctrl.signal.aborted) return;
      if (res.report) {
        updateSession(id, { coach: res.report });
        setRec((cur) => cur && { ...cur, coach: res.report });
        setCoachNotice(null);
      } else {
        const quick = rulesCoach(r);
        setRec((cur) => cur && { ...cur, coach: cur.coach?.source === "llm" ? cur.coach : quick });
        if (res.retryAfter && res.retryAfter <= 90) {
          setCoachNotice(`The AI coach is busy, so these are quick notes for now. Detailed notes load in about ${res.retryAfter} seconds.`);
          retry = setTimeout(() => void coach(r), res.retryAfter * 1000 + 800);
        } else {
          setCoachNotice(`These are quick notes. ${res.error ?? ""}`.trim());
        }
      }
      setPhase("done");
    };

    (async () => {
      let r = initial;
      if (!r.analysis && r.sessionId && r.durationSec > 3) {
        setPhase("transcribing");
        try {
          const analysis = await runAnalysis(r, ctrl.signal);
          r = { ...r, analysis };
          updateSession(id, { analysis });
          setRec(r);
        } catch (e) {
          if (ctrl.signal.aborted) return;
          setAnalysisError(errMsg(e));
        }
      }
      await coach(r);
    })();

    return () => {
      ctrl.abort();
      clearTimeout(retry);
    };
  }, [id]);

  // Coming back from a retake: bring the moment into view once the report has rendered.
  const loaded = !!rec?.coach;
  useEffect(() => {
    if (!loaded || !window.location.hash.startsWith("#moment-")) return;
    const id = requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(id);
  }, [loaded]);

  const sessionId = rec?.sessionId;
  const loadAudio = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/recording/${sessionId}`, { cache: "no-store" });
    if (res.ok) setAudioUrl((await res.json()).url);
  }, [sessionId]);
  useEffect(() => {
    void loadAudio();
  }, [loadAudio]);

  const seek = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    void a.play().catch(() => {});
  };

  if (rec === undefined) return <div className="wrap center-state"><span className="spinner" /></div>;
  if (rec === null)
    return (
      <div className="wrap center-state">
        <h1 className="h2">This replay isn&rsquo;t on this device</h1>
        <p className="lede">Practice history is saved in the browser where you practiced.</p>
        <Link className="btn" href="/#scenes">
          Choose a scene
        </Link>
      </div>
    );

  const scene = sceneById(rec.sceneId) as Scene;
  const persona = scene.personas.find((p) => p.name === rec.personaName) ?? scene.personas[0];
  const talk = scene.kind === "talk";
  const next = SCENES.find((s) => s.level > scene.level) ?? SCENES.find((s) => s.id !== scene.id && s.level === scene.level);
  const coach = rec.coach;
  const goalsDone = { ...rec.goals };
  if (!talk) for (const g of coach?.goals ?? []) if (g.done) goalsDone[g.id] = true;
  const evidence = (coach?.goals ?? []).filter((g) => g.evidence && g.done === !!goalsDone[g.id]);
  const when = new Date(rec.createdAt).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

  return (
    <div className="wrap report">
      <header className="report__head">
        <Link href="/#history" className="link-back">
          ← Your practice
        </Link>
        <p className="report__meta">
          {scene.title} with {persona.name}. {when}, {mmss(rec.durationSec)} long.
          {rec.topic ? ` Topic: “${rec.topic}”.` : ""}
        </p>
        {coach ? (
          <h1 className="report__headline">{coach.headline}</h1>
        ) : (
          <div className="skeleton" style={{ height: 96, maxWidth: 720 }} aria-label="Writing your feedback" />
        )}
        <p className="report__outcome">
          {outcomeText(rec.outcome, persona, scene.kind)}{" "}
          {talk ? "Audience attention" : `${persona.name}'s warmth`} went from {rec.startWarmth} to {rec.finalWarmth}.
        </p>
        <div className="report__actions">
          <Link className="btn" href={`/practice/${scene.id}`}>
            Practice this again
          </Link>
          {next && (
            <Link className="btn btn--ghost" href={`/practice/${next.id}`}>
              Next: {next.title}
            </Link>
          )}
        </div>
      </header>

      <section className="block" aria-labelledby="curve-title">
        <div className="block__head">
          <h2 id="curve-title" className="h2">
            {talk ? "How the room's attention moved" : `How warm ${persona.name} got`}
          </h2>
          <p className="muted">
            {talk
              ? "Attention sags during long silences and rises with clear answers. Pins mark moments the coach picked out."
              : "Each dot is one of your turns. Hover or tab through them to see what moved it. Pins mark moments the coach picked out."}
          </p>
        </div>
        <div className="card">
          <WarmthChart points={rec.points} start={rec.startWarmth} duration={rec.durationSec} moments={coach?.moments ?? []} talk={talk} onSeek={seek} />
        </div>
      </section>

      <section className="block" aria-labelledby="sound-title">
        <div className="block__head">
          <h2 id="sound-title" className="h2">
            How you sounded
          </h2>
          <p className="muted">Measured from the recording, word by word, including every um and uh.</p>
        </div>
        {rec.analysis ? (
          <div className="tiles">
            {tilesFor(rec.analysis.metrics, rec, talk).map((t) => (
              <Tile key={t.label} {...t} />
            ))}
          </div>
        ) : phase === "transcribing" ? (
          <>
            <p className="progress-note" role="status">
              <span className="spinner" /> Transcribing your recording. This takes about 10 to 30 seconds.
            </p>
            <div className="tiles" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 132 }} />
              ))}
            </div>
          </>
        ) : (
          <p className="notice">{analysisError ?? "There's no recording for this session, so speaking metrics aren't available."}</p>
        )}
      </section>

      <section className="block" aria-labelledby="coach-title">
        <div className="block__head">
          <h2 id="coach-title" className="h2">
            Coach notes
          </h2>
          <p className="muted small">
            {coach?.source === "llm"
              ? `Written by ${coach.model} through AssemblyAI's LLM Gateway, from your transcript and metrics.`
              : coach
                ? "Quick notes from your warmth signals and metrics."
                : "Reading your transcript…"}
          </p>
          {coachNotice && (
            <p className="progress-note small" role="status">
              {phase === "coaching" && <span className="spinner" />} {coachNotice}
            </p>
          )}
        </div>
        {coach ? (
          <>
            <div className="notes">
              {coach.strengths.map((s, i) => (
                <article key={`s${i}`} className="note">
                  <StatusLabel status="good" text="What worked" />
                  <h3 className="note__title">{s.title}</h3>
                  <p>{s.detail}</p>
                </article>
              ))}
              {coach.improvements.map((s, i) => (
                <article key={`i${i}`} className="note">
                  <StatusLabel status="meh" text="Try next time" />
                  <h3 className="note__title">{s.title}</h3>
                  <p>{s.detail}</p>
                  {s.tryInstead && (
                    <p className="note__try">
                      <span className="note__try-label">You could say</span>
                      {s.tryInstead}
                    </p>
                  )}
                </article>
              ))}
            </div>
            {coach.nextStep && (
              <p className="next-step">
                <b>Your one thing for next time</b>
                {coach.nextStep}
              </p>
            )}
          </>
        ) : (
          <div className="notes" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 150 }} />
            ))}
          </div>
        )}
      </section>

      <section className="block" aria-labelledby="goals-title">
        <h2 id="goals-title" className="h2">
          Goals
        </h2>
        <div className="card">
          <GoalList scene={scene} done={goalsDone} />
          {evidence.length > 0 && (
            <ul className="tips small" style={{ marginTop: 14 }}>
              {evidence.map((g) => (
                  <li key={g.id}>
                    {scene.goals.find((x) => x.id === g.id)?.label ?? g.id}: {g.evidence}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      {coach && coach.moments.length > 0 && (
        <section className="block" aria-labelledby="moments-title">
          <h2 id="moments-title" className="h2">
            Moments to replay
          </h2>
          <ol className="moments">
            {coach.moments.map((mo, i) => (
              <li key={i} className="moment" id={`moment-${i}`}>
                <div className="moment__time">
                  <button className="play" onClick={() => seek(mo.at)} disabled={!audioUrl} aria-label={`Play from ${mmss(mo.at)}`}>
                    <PlayIcon /> {mmss(mo.at)}
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <StatusLabel status={mo.kind === "great" ? "good" : mo.kind === "missed" ? "meh" : "bad"} text={mo.kind === "great" ? "Great moment" : mo.kind === "missed" ? "Missed chance" : "Awkward moment"} />
                  <p className="moment__quote">“{mo.quote}”</p>
                  <p>{mo.comment}</p>
                  {mo.better && <p className="moment__better">You could say: “{mo.better.replace(/^[“"]|[”"]$/g, "")}”</p>}
                  <Retake rec={rec} index={i} talk={talk} kind={mo.kind} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="block" aria-labelledby="script-title">
        <div className="block__head">
          <h2 id="script-title" className="h2">
            The conversation
          </h2>
          <p className="muted">
            {rec.analysis ? "Filler words are highlighted. Click a time to hear that moment." : "Live transcript from the session."}
          </p>
        </div>
        <div className="card">
          <Script rec={rec} name={persona.name} onSeek={audioUrl ? seek : undefined} />
        </div>
      </section>

      {audioUrl && (
        <div className="player">
          <span className="player__label">Recording</span>
          <audio ref={audioRef} controls preload="metadata" src={audioUrl} onError={() => void loadAudio()} />
        </div>
      )}
    </div>
  );
}

function Retake({ rec, index, talk, kind }: { rec: SessionRecord; index: number; talk: boolean; kind: string }) {
  if (talk) return null;
  const result = rec.retakes?.[index];
  const plan = planRetake(rec, index);
  if (!plan) return null;
  return (
    <div className="retake">
      {result && (
        <div className="retake__result">
          <p className="note__try-label">Your retake</p>
          <p className="moment__quote">“{result.said}”</p>
          <div className="feed">
            {result.signals.map((s, k) => (
              <span key={k} className={`chip ${s.delta > 0 ? "chip--up" : "chip--down"}`}>
                <span className="chip__delta">{s.delta > 0 ? `+${s.delta}` : `−${-s.delta}`}</span>
                {s.label}
              </span>
            ))}
          </div>
          <p className="small muted">{compareRetake(plan, result)}</p>
        </div>
      )}
      {kind !== "great" && (
        <Link className="btn btn--ghost btn--quiet" href={`/practice/${rec.sceneId}?retake=${rec.id}.${index}`}>
          {result ? "Try it once more" : "Try this moment again"}
        </Link>
      )}
    </div>
  );
}

function Script({ rec, name, onSeek }: { rec: SessionRecord; name: string; onSeek?: (t: number) => void }) {
  if (!rec.analysis) {
    return (
      <div className="script">
        {rec.lines.map((l, i) => (
          <p key={i} className={`script__line script__line--${l.who}`}>
            <span className="script__time">{mmss(l.t)}</span>
            <span>
              <span className="script__who">{l.who === "you" ? "You" : name}</span>
              <span className="script__text">{l.text}</span>
            </span>
          </p>
        ))}
      </div>
    );
  }
  const utts = rec.analysis.utterances;
  return (
    <div className="script">
      {utts.map((u, i) => {
        const prev = utts[i - 1];
        const gap = prev && prev.who === "them" && u.who === "you" ? (u.start - prev.end) / 1000 : 0;
        return (
          <div key={i} className={`script__line script__line--${u.who}`}>
            {onSeek ? (
              <button className="script__time" onClick={() => onSeek(u.start / 1000)} aria-label={`Play from ${mmss(u.start / 1000)}`}>
                {mmss(u.start / 1000)}
              </button>
            ) : (
              <span className="script__time">{mmss(u.start / 1000)}</span>
            )}
            <p>
              {gap >= 2.5 && <span className="script__gap">{gap.toFixed(1)} seconds before you answered</span>}
              <span className="script__who">{u.who === "you" ? "You" : name}</span>
              <span className="script__text">
                {u.who === "you" && u.words.length
                  ? u.words.map((w, k) => (
                      <span key={k}>
                        {k > 0 && " "}
                        {isFiller(w.text) ? <mark className="filler">{w.text}</mark> : w.text}
                      </span>
                    ))
                  : u.text}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface TileProps {
  label: string;
  value: string;
  unit?: string;
  status: Status;
  statusText: string;
  note: string;
}

function Tile({ label, value, unit, status, statusText, note }: TileProps) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">
        {value}
        {unit && <span className="tile__unit">{unit}</span>}
      </span>
      <StatusLabel status={status} text={statusText} />
      <span className="tile__note">{note}</span>
    </div>
  );
}

function tilesFor(m: Metrics, rec: SessionRecord, talk: boolean): TileProps[] {
  const fillerBreakdown = Object.entries(m.fillerWords)
    .map(([w, n]) => `${w} ×${n}`)
    .join(", ");
  const pace: TileProps = {
    label: "Pace",
    value: m.wpm === null ? "–" : String(m.wpm),
    unit: "words/min",
    status: m.wpm === null ? "meh" : m.wpm < 105 ? "meh" : m.wpm > 180 ? "meh" : "good",
    statusText: m.wpm === null ? "Not enough speech" : m.wpm < 105 ? "On the slow side" : m.wpm > 180 ? "On the fast side" : "Easy to follow",
    note: "Around 120 to 170 words a minute is comfortable to listen to.",
  };
  const fillers: TileProps = {
    label: "Filler words",
    value: m.fillersPerMin === null ? String(m.fillers) : String(m.fillersPerMin),
    unit: m.fillersPerMin === null ? "total" : "per min",
    // In short sessions one "uh" is a high per-minute rate, so 0-1 fillers always count as barely any.
    status: m.fillers <= 1 || m.fillersPerMin === null || m.fillersPerMin < 2 ? "good" : m.fillersPerMin < 4 ? "meh" : "bad",
    statusText: m.fillers <= 1 || m.fillersPerMin === null || m.fillersPerMin < 2 ? "Barely any" : m.fillersPerMin < 4 ? "A few" : "Quite a lot",
    note: fillerBreakdown ? `${m.fillers} in total: ${fillerBreakdown}.` : "No ums or uhs detected.",
  };
  const pause: TileProps = {
    label: "Longest pause mid-sentence",
    value: m.longestPause.toFixed(1),
    unit: "sec",
    status: m.longestPause <= 2 ? "good" : m.longestPause <= 3.5 ? "meh" : "bad",
    statusText: m.longestPause <= 2 ? "Smooth" : m.longestPause <= 3.5 ? "Noticeable" : "Long",
    note: `${m.pauses} ${m.pauses === 1 ? "pause" : "pauses"} over 1.5 seconds inside your own turns. Short pauses sound thoughtful.`,
  };

  if (talk) {
    const secs = rec.talkSeconds ?? 0;
    const tics = Object.entries(m.tics).sort((a, b) => b[1] - a[1]);
    const ticCount = tics.reduce((s, [, n]) => s + n, 0);
    return [
      {
        label: "Talk length",
        value: String(secs),
        unit: "sec",
        status: secs >= 60 ? "good" : secs >= 40 ? "meh" : "bad",
        statusText: secs >= 60 ? "Filled the time" : secs >= 40 ? "A bit short" : "Very short",
        note: "The target was 60 to 90 seconds before questions.",
      },
      pace,
      fillers,
      pause,
      {
        label: "Verbal tics",
        value: String(ticCount),
        status: ticCount <= 3 ? "good" : ticCount <= 7 ? "meh" : "bad",
        statusText: ticCount <= 3 ? "Hardly any" : ticCount <= 7 ? "Noticeable" : "Frequent",
        note: tics.length ? `Most used: ${tics.slice(0, 3).map(([w, n]) => `“${w}” ×${n}`).join(", ")}.` : "No “like”, “you know” or “basically” habits.",
      },
      qaTile(rec),
    ];
  }

  return [
    {
      label: "Response time",
      value: m.avgGap === null ? "–" : m.avgGap.toFixed(1),
      unit: "sec",
      status: m.avgGap === null || m.avgGap <= 1.8 ? "good" : m.avgGap <= 3 ? "meh" : "bad",
      statusText: m.avgGap === null ? "Not measured" : m.avgGap <= 1.8 ? "Natural" : m.avgGap <= 3 ? "A little hesitant" : "Long pauses",
      note: m.longestGap === null ? "Time from the end of their line to your first word." : `Time from the end of their line to your first word. Longest: ${m.longestGap}s.`,
    },
    {
      label: "Your share of the talking",
      value: m.talkShare === null ? "–" : String(Math.round(m.talkShare * 100)),
      unit: "%",
      status: m.talkShare === null ? "meh" : m.talkShare >= 0.35 && m.talkShare <= 0.65 ? "good" : "meh",
      statusText:
        m.talkShare === null ? "Not measured" : m.talkShare < 0.35 ? "They carried it" : m.talkShare > 0.65 ? "You carried it" : "Balanced",
      note: "Between 35% and 65% feels like a two-way conversation.",
    },
    {
      label: "Questions you asked",
      value: String(m.questions),
      status: m.questions >= 2 ? "good" : m.questions === 1 ? "meh" : "bad",
      statusText: m.questions >= 2 ? "Curious" : m.questions === 1 ? "Just one" : "None",
      note: "Questions, especially follow-ups, are what make people open up.",
    },
    fillers,
    pace,
    pause,
  ];
}

/** Talk mode: how long the Q&A answers were, from the utterances after Q&A began. */
function qaTile(rec: SessionRecord): TileProps {
  const from = (rec.qaStartedAt ?? Infinity) * 1000;
  const answers = (rec.analysis?.utterances ?? []).filter((u) => u.who === "you" && u.start >= from - 1500);
  const avg = answers.length ? answers.reduce((s, u) => s + (u.end - u.start), 0) / answers.length / 1000 : null;
  return {
    label: "Average Q&A answer",
    value: avg === null ? "–" : avg.toFixed(0),
    unit: avg === null ? undefined : "sec",
    status: avg === null ? "meh" : avg >= 8 && avg <= 45 ? "good" : "meh",
    statusText: avg === null ? "No answers recorded" : avg < 8 ? "Very brief" : avg > 45 ? "Long-winded" : "Well sized",
    note: "Good answers take 15 to 45 seconds: answer, give a reason, stop.",
  };
}

function StatusLabel({ status, text }: { status: Status; text: string }) {
  return (
    <span className={`status status--${status}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {status === "good" ? (
          <path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : status === "meh" ? (
          <path d="M3 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M7 2.5v5.5M7 11v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
      {text}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 1.2v7.6L8.6 5z" fill="currentColor" />
    </svg>
  );
}
