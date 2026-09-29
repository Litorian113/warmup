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

/** A point is saved when the turn ends; playing it starts a few seconds earlier, as the turn begins. */
const turnSpot = (t: number) => Math.max(0, t - 4);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

interface Props {
  points: WarmthPoint[];
  start: number;
  duration: number;
  moments: CoachReport["moments"];
  talk: boolean;
  onSeek?: (t: number) => void;
  playback?: Playback;
}

export default function WarmthChart({ points, start, duration, moments, talk, onSeek, playback }: Props) {
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
  const H = narrow ? 240 : 280;
  const m = { top: 14, right: 14, bottom: 52, left: narrow ? 84 : 104 };
  const iw = w - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const x = (t: number) => m.left + (Math.min(t, T) / T) * iw;
  const y = (v: number) => m.top + (1 - v / 100) * ih;
  const bands = talk ? TALK_BANDS : CONVO_BANDS;

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
  const playheadX = playback?.playing ? x(playback.now) : null;
  const key = (e: React.KeyboardEvent, t: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSeek?.(t);
    }
  };

  return (
    <div className="chart" ref={wrap}>
      <svg width={w} height={H} role="img" aria-label={`${talk ? "Audience attention" : "Warmth"} over the conversation, from ${start} to ${data[data.length - 1].value} out of 100.`}>
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

        {/* where the recording is playing right now */}
        {playheadX !== null && (
          <g className="chart__playhead" style={{ transform: `translateX(${playheadX.toFixed(1)}px)` }} aria-hidden="true">
            <line x1={0} x2={0} y1={m.top} y2={y(0) + 24} />
            <circle cx={0} cy={m.top} r={3.5} />
          </g>
        )}

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

        {/* coach moments, pinned under the timeline */}
        {moments.map((mo, i) => {
          const active = isPlayingFrom(playback, mo.at);
          const cx = x(mo.at);
          const cy = y(0) + 36;
          return (
            <g
              key={i}
              className={`chart__moment${active ? " is-playing" : ""}`}
              tabIndex={0}
              role="button"
              aria-pressed={active}
              aria-label={`${KIND[mo.kind].label} at ${mmss(mo.at)}: ${mo.comment}. ${active ? "Pause" : "Play"}.`}
              onClick={() => onSeek?.(mo.at)}
              onKeyDown={(e) => key(e, mo.at)}
            >
              <title>{`${KIND[mo.kind].label} at ${mmss(mo.at)}. Click to ${active ? "pause" : "play"}.`}</title>
              <circle cx={cx} cy={cy} r={14} fill="transparent" />
              {active && <circle className="chart__pulse" cx={cx} cy={cy} r={11} style={{ stroke: KIND[mo.kind].color }} />}
              <circle className="chart__marker" cx={cx} cy={cy} r={active ? 9 : 7} fill={KIND[mo.kind].color} stroke="#fff" strokeWidth={2} />
              {active ? (
                <path d={`M${cx - 3} ${cy - 3.5}h2v7h-2zM${cx + 1} ${cy - 3.5}h2v7h-2z`} fill="#fff" />
              ) : (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="800" fill="#fff">
                  {mo.kind === "great" ? "✓" : "!"}
                </text>
              )}
            </g>
          );
        })}
      </svg>

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

      <Turns points={points} talk={talk} onSeek={onSeek} playback={playback} />
    </div>
  );
}

/** Every scored turn as a card: what you said, what it did to the meter, and why. */
function Turns({ points, talk, onSeek, playback }: { points: WarmthPoint[]; talk: boolean; onSeek?: (t: number) => void; playback?: Playback }) {
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
          <Turn key={i} p={p} talk={talk} onSeek={onSeek} playback={playback} />
        ))}
      </ol>
    </details>
  );
}

function Turn({ p, talk, onSeek, playback }: { p: WarmthPoint; talk: boolean; onSeek?: (t: number) => void; playback?: Playback }) {
  const [open, setOpen] = useState(false);
  const long = p.said.length > 220;
  const tone = p.delta > 0 ? "up" : p.delta < 0 ? "down" : "flat";
  const spot = turnSpot(p.t);
  return (
    <li className={`turn turn--${tone}${isPlayingFrom(playback, spot) ? " is-playing" : ""}`}>
      <div className="turn__when">
        {onSeek && playback ? <PlayButton at={spot} playback={playback} onToggle={onSeek} /> : <span className="turn__time">{mmss(p.t)}</span>}
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
      <div className="turn__score" aria-label={`${talk ? "Attention" : "Warmth"} ${p.value}, ${signed(p.delta)}`}>
        <span className={`turn__delta turn__delta--${tone}`}>{signed(p.delta)}</span>
        <span className="turn__value">
          <span className="temp-dot" style={{ background: warmthColor(p.value) }} aria-hidden="true" />
          {p.value}
        </span>
      </div>
    </li>
  );
}
