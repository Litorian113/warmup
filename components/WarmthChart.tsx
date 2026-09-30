"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isPlayingFrom, PlayButton, type Playback } from "./playback";
import { mmss } from "@/lib/metrics";
import { MOODS, moodFor } from "@/lib/scenarios";
import type { CoachReport, WarmthPoint } from "@/lib/store";
import { WARMTH_STOPS, warmthColor } from "@/lib/warmth";

const CONVO_BANDS = ["Checking out", "Bored", "Open", "Interested", "Enjoying it"];
const TALK_BANDS = ["Lost them", "Drifting", "Listening", "Engaged", "Hooked"];
const KIND = {
  great: { color: "var(--good)", label: "Great moment" },
  missed: { color: "var(--meh)", label: "Missed chance" },
  awkward: { color: "var(--bad)", label: "Awkward moment" },
} as const;

/**
 * Where playing a turn starts. A point is scored a few seconds after you stop talking, when the
 * reply begins, so play from the start of your last turn before it, as timed in the recording's
 * transcript. Without a transcript, go back 4 seconds.
 */
function spotFinder(youTurns: { start: number; end: number }[] = []) {
  return (t: number) => {
    for (let i = youTurns.length - 1; i >= 0; i--) {
      const u = youTurns[i];
      if (u.start <= t) return t - u.end < 10 ? u.start : Math.max(0, t - 4);
    }
    return Math.max(0, t - 4);
  };
}
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

interface Props {
  points: WarmthPoint[];
  start: number;
  duration: number;
  moments: CoachReport["moments"];
  talk: boolean;
  onSeek?: (t: number) => void;
  playback?: Playback;
  /** The recording, for the playhead. */
  audio?: React.RefObject<HTMLAudioElement | null>;
  /** Your turns in the recording, in seconds, so a turn plays from where you started it. */
  youTurns?: { start: number; end: number }[];
}

export default function WarmthChart({ points, start, duration, moments, talk, onSeek, playback, audio, youTurns }: Props) {
  const turnSpot = spotFinder(youTurns);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data: WarmthPoint[] = [{ t: 0, value: start, delta: 0, signals: [], said: "" }, ...points];
  const T = Math.max(duration, data[data.length - 1].t + 5, 20);
  const narrow = w < 520;
  const pinned = moments.length > 0;
  // Room above the plot for the coach's numbered flags, and none below it any more.
  const H = (narrow ? 230 : 270) + (pinned ? 50 : 0);
  const m = { top: pinned ? 64 : 14, right: 14, bottom: 34, left: narrow ? 84 : 104 };
  const iw = w - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const x = (t: number) => m.left + (Math.min(t, T) / T) * iw;
  const y = (v: number) => m.top + (1 - v / 100) * ih;
  const bands = talk ? TALK_BANDS : CONVO_BANDS;
  /** The curve's value at time t (it runs straight between turns, then flat to the end). */
  const valueAt = (t: number) => {
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1];
      const b = data[i];
      if (t <= b.t) return b.t === a.t ? b.value : a.value + ((b.value - a.value) * (t - a.t)) / (b.t - a.t);
    }
    return data[data.length - 1].value;
  };
  // Flags that would touch get staggered onto a second, higher row.
  const flagRow: number[] = [];
  moments.forEach((mo, i) => {
    const prev = moments.findIndex((o, j) => j < i && Math.abs(x(o.at) - x(mo.at)) < 30 && flagRow[j] === 0);
    flagRow[i] = prev >= 0 ? 1 : 0;
  });

  const line = [...data, { ...data[data.length - 1], t: T }].map((d, i) => `${i ? "L" : "M"}${x(d.t).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = `${line}L${x(T).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`;
  const step = T <= 90 ? 15 : T <= 200 ? 30 : 60;
  const ticks = Array.from({ length: Math.floor(T / step) + 1 }, (_, i) => i * step);

  const nearest = (px: number) => {
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].t) - px) < Math.abs(x(data[best].t) - px)) best = i;
    return best;
  };

  const hp = hover !== null ? data[hover] : null;
  const tipLeft = hp ? (x(hp.t) > w / 2 ? Math.max(0, x(hp.t) - 312) : Math.min(w - 300, x(hp.t) + 12)) : 0;
  const hoverPlaying = hp ? isPlayingFrom(playback, turnSpot(hp.t)) : false;
  const key = (e: React.KeyboardEvent, t: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSeek?.(t);
    }
  };

  return (
    <div className="chart" ref={wrap}>
      <svg width={w} height={H} role="img" aria-label={`${talk ? "Audience attention" : "Interest"} over the conversation, from ${start} to ${data[data.length - 1].value} out of 100.`}>
        <defs>
          <linearGradient id={`heat${gid}`} gradientUnits="userSpaceOnUse" x1="0" y1={y(0)} x2="0" y2={y(100)}>
            {WARMTH_STOPS.map(([p, c]) => (
              <stop key={p} offset={p / 100} stopColor={c} />
            ))}
          </linearGradient>
        </defs>

        {/* mood bands: hairline boundaries, labels at band centers */}
        {MOODS.map((mo, i) => {
          const to = MOODS[i + 1]?.min ?? 100;
          return (
            <g key={mo.id}>
              {i > 0 && <line className="chart__grid" x1={m.left} x2={m.left + iw} y1={y(mo.min)} y2={y(mo.min)} />}
              <text className="chart__tick" x={m.left - 12} y={y((mo.min + to) / 2)} textAnchor="end" dominantBaseline="middle">
                {bands[i]}
              </text>
            </g>
          );
        })}
        <line x1={m.left} x2={m.left + iw} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
        {ticks.map((t) => (
          <text key={t} className="chart__tick" x={x(t)} y={y(0) + 18} textAnchor="middle">
            {mmss(t)}
          </text>
        ))}

        <path d={area} fill={`url(#heat${gid})`} opacity={0.12} />
        <path d={line} fill="none" stroke={`url(#heat${gid})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={m.top} y2={y(0)} stroke="var(--ink-3)" strokeWidth={1} />}

        {playback?.playing && audio && <Playhead audio={audio} x={x} top={m.top} bottom={y(0) + 24} />}

        {/* pointer layer: the crosshair snaps to the nearest turn */}
        <rect
          x={m.left}
          y={m.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={(e) => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            setHover(nearest(e.clientX - r.left));
          }}
          onPointerLeave={() => setHover(null)}
        />

        {data.map((d, i) => {
          if (i === 0 || d.kind === "tick") return null;
          const active = isPlayingFrom(playback, turnSpot(d.t));
          return (
            <g
              key={i}
              className={`chart__point${active ? " is-playing" : ""}`}
              tabIndex={0}
              role="button"
              aria-pressed={active}
              aria-label={`${mmss(d.t)}: ${d.value} out of 100. You said: ${d.said}. ${active ? "Pause" : "Play"} this turn.`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onPointerEnter={() => setHover(i)}
              onClick={() => onSeek?.(turnSpot(d.t))}
              onKeyDown={(e) => key(e, turnSpot(d.t))}
            >
              <circle cx={x(d.t)} cy={y(d.value)} r={12} fill="transparent" />
              {active && <circle className="chart__pulse" cx={x(d.t)} cy={y(d.value)} r={9} />}
              <circle className="chart__dot" cx={x(d.t)} cy={y(d.value)} r={hover === i || active ? 6 : 4.5} fill={warmthColor(d.value)} stroke="#fff" strokeWidth={2} />
            </g>
          );
        })}

        {/* The coach's moments, as numbered flags standing on the curve. The number matches the
            moment in "Moments to replay"; click a flag to hear that moment. */}
        {moments.map((mo, i) => {
          const active = isPlayingFrom(playback, mo.at);
          const cx = x(mo.at);
          const cy = y(valueAt(mo.at));
          const fy = flagRow[i] ? 16 : 40;
          const color = KIND[mo.kind].color;
          return (
            <g
              key={i}
              className={`chart__moment${active ? " is-playing" : ""}`}
              tabIndex={0}
              role="button"
              aria-pressed={active}
              aria-label={`Moment ${i + 1}, ${KIND[mo.kind].label.toLowerCase()} at ${mmss(mo.at)}: ${mo.comment}. ${active ? "Pause" : "Play"}.`}
              onClick={() => onSeek?.(mo.at)}
              onKeyDown={(e) => key(e, mo.at)}
            >
              <title>{`${i + 1}. ${KIND[mo.kind].label} at ${mmss(mo.at)}. Click to ${active ? "pause" : "play"}.`}</title>
              <line className="chart__stem" x1={cx} x2={cx} y1={fy + 12} y2={cy} style={{ stroke: color }} />
              <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
              <circle cx={cx} cy={fy} r={18} fill="transparent" />
              {active && <circle className="chart__pulse" cx={cx} cy={fy} r={14} style={{ stroke: color }} />}
              <circle className="chart__flag" cx={cx} cy={fy} r={12} fill={color} stroke="#fff" strokeWidth={2.5} />
              {active ? (
                <path d={`M${cx - 3.5} ${fy - 4}h2.5v8h-2.5zM${cx + 1} ${fy - 4}h2.5v8h-2.5z`} fill="#fff" />
              ) : (
                <text x={cx} y={fy + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="#fff">
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {pinned && (
        <ul className="chart__legend" aria-label="What the flags mean">
          {(["great", "missed", "awkward"] as const)
            .filter((k) => moments.some((mo) => mo.kind === k))
            .map((k) => (
              <li key={k}>
                <span className="chart__legend-dot" style={{ background: KIND[k].color }} aria-hidden="true" />
                {KIND[k].label}
              </li>
            ))}
          <li className="chart__legend-hint">Numbered flags are the coach&rsquo;s moments below. Click one to hear it.</li>
        </ul>
      )}

      {hp && (
        <div className="tooltip" style={{ left: tipLeft, top: 4 }} role="presentation">
          <span className="tooltip__value">
            {hp.value} / 100, {hover === 0 ? "at the start" : (talk ? TALK_BANDS : CONVO_BANDS)[MOODS.indexOf(moodFor(hp.value))].toLowerCase()}
          </span>
          <span>{hover === 0 ? "Before you said anything" : hp.kind === "tick" ? `During your talk, at ${mmss(hp.t)}` : `At ${mmss(hp.t)}`}</span>
          {hp.said && <span className="tooltip__said">“{hp.said.length > 140 ? `${hp.said.slice(0, 140)}…` : hp.said}”</span>}
          {hp.signals.length > 0 && (
            <ul className="tooltip__signals">
              {hp.signals.map((s, i) => (
                <li key={i}>
                  {signed(s.delta)} {s.label}
                </li>
              ))}
            </ul>
          )}
          {onSeek && hover !== 0 && hp.kind !== "tick" && <span className="tooltip__hint">{hoverPlaying ? "Click to pause" : "Click to hear this turn"}</span>}
        </div>
      )}

      <Turns points={points} talk={talk} onSeek={onSeek} playback={playback} turnSpot={turnSpot} />
    </div>
  );
}

/**
 * Where the recording is playing right now. It follows the audio element itself, so while audio
 * plays only this re-renders, not the chart or the report around it.
 */
function Playhead({ audio, x, top, bottom }: { audio: React.RefObject<HTMLAudioElement | null>; x: (t: number) => number; top: number; bottom: number }) {
  const [now, setNow] = useState(() => audio.current?.currentTime ?? 0);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const update = () => setNow(a.currentTime);
    a.addEventListener("timeupdate", update);
    return () => a.removeEventListener("timeupdate", update);
  }, [audio]);
  return (
    <g className="chart__playhead" style={{ transform: `translateX(${x(now).toFixed(1)}px)` }} aria-hidden="true">
      <line x1={0} x2={0} y1={top} y2={bottom} />
      <circle cx={0} cy={top} r={3.5} />
    </g>
  );
}

/** Every scored turn as a card: what you said, what it did to the meter, and why. */
interface TurnsProps {
  talk: boolean;
  onSeek?: (t: number) => void;
  playback?: Playback;
  turnSpot: (t: number) => number;
}

function Turns({ points, ...rest }: TurnsProps & { points: WarmthPoint[] }) {
  const turns = points.filter((p) => p.kind !== "tick");
  if (!turns.length) return null;
  const up = turns.filter((p) => p.delta > 0).length;
  const down = turns.filter((p) => p.delta < 0).length;
  return (
    <details className="turns-block">
      <summary>
        <span className="turns-block__title">Turn by turn</span>
        <span className="turns-block__meta">
          {turns.length} {turns.length === 1 ? "turn" : "turns"}
          {up > 0 && <span className="turn__delta turn__delta--up">{up} up</span>}
          {down > 0 && <span className="turn__delta turn__delta--down">{down} down</span>}
        </span>
      </summary>
      <ol className="turns">
        {turns.map((p, i) => (
          <Turn key={i} p={p} {...rest} />
        ))}
      </ol>
    </details>
  );
}

function Turn({ p, talk, onSeek, playback, turnSpot }: TurnsProps & { p: WarmthPoint }) {
  const [open, setOpen] = useState(false);
  const long = p.said.length > 220;
  const tone = p.delta > 0 ? "up" : p.delta < 0 ? "down" : "flat";
  const spot = turnSpot(p.t);
  return (
    <li className={`turn turn--${tone}${isPlayingFrom(playback, spot) ? " is-playing" : ""}`}>
      <div className="turn__when">
        {onSeek && playback ? <PlayButton at={spot} playback={playback} onToggle={onSeek} /> : <span className="turn__time">{mmss(spot)}</span>}
      </div>
      <div className="turn__body">
        <p className={`turn__said${long && !open ? " is-clamped" : ""}`}>“{p.said}”</p>
        {long && (
          <button className="turn__more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Show less" : "Show all"}
          </button>
        )}
        <div className="turn__signals">
          {p.signals.length ? (
            p.signals.map((s, k) => (
              <span key={k} className={`chip ${s.delta > 0 ? "chip--up" : "chip--down"}`}>
                <span className="chip__delta">{signed(s.delta)}</span>
                {s.label}
              </span>
            ))
          ) : (
            <span className="small muted">Nothing moved the meter.</span>
          )}
        </div>
      </div>
      <div className="turn__score" aria-label={`${talk ? "Attention" : "Interest"} ${p.value}, ${signed(p.delta)}`}>
        <span className={`turn__delta turn__delta--${tone}`}>{signed(p.delta)}</span>
        <span className="turn__value">
          <span className="temp-dot" style={{ background: warmthColor(p.value) }} aria-hidden="true" />
          {p.value}
        </span>
      </div>
    </li>
  );
}
