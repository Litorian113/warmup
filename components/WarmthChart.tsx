"use client";

import { useEffect, useId, useRef, useState } from "react";
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

interface Props {
  points: WarmthPoint[];
  start: number;
  duration: number;
  moments: CoachReport["moments"];
  talk: boolean;
  onSeek?: (t: number) => void;
}

export default function WarmthChart({ points, start, duration, moments, talk, onSeek }: Props) {
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

        {data.map((d, i) =>
          i === 0 || d.kind === "tick" ? null : (
            <g
              key={i}
              className="chart__point"
              tabIndex={0}
              role="button"
              aria-label={`${mmss(d.t)}: ${d.value} out of 100. You said: ${d.said}`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onPointerEnter={() => setHover(i)}
              onClick={() => onSeek?.(Math.max(0, d.t - 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeek?.(Math.max(0, d.t - 4));
                }
              }}
            >
              <circle cx={x(d.t)} cy={y(d.value)} r={12} fill="transparent" />
              <circle className="chart__dot" cx={x(d.t)} cy={y(d.value)} r={hover === i ? 6 : 4.5} fill={warmthColor(d.value)} stroke="#fff" strokeWidth={2} />
            </g>
          ),
        )}

        {/* coach moments, pinned under the timeline */}
        {moments.map((mo, i) => (
          <g
            key={i}
            tabIndex={0}
            role="button"
            aria-label={`${KIND[mo.kind].label} at ${mmss(mo.at)}: ${mo.comment}`}
            style={{ cursor: "pointer" }}
            onClick={() => onSeek?.(mo.at)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSeek?.(mo.at);
              }
            }}
          >
            <title>{`${KIND[mo.kind].label} at ${mmss(mo.at)}`}</title>
            <circle cx={x(mo.at)} cy={y(0) + 36} r={12} fill="transparent" />
            <circle cx={x(mo.at)} cy={y(0) + 36} r={7} fill={KIND[mo.kind].color} stroke="#fff" strokeWidth={2} />
            <text x={x(mo.at)} y={y(0) + 36} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="800" fill="#fff">
              {mo.kind === "great" ? "✓" : "!"}
            </text>
          </g>
        ))}
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
                  {s.delta > 0 ? `+${s.delta}` : `−${-s.delta}`} {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="chart-table">
        <summary>Show turn by turn</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">{talk ? "Attention" : "Warmth"}</th>
              <th scope="col">You said</th>
              <th scope="col">What moved it</th>
            </tr>
          </thead>
          <tbody>
            {points.filter((p) => p.kind !== "tick").map((p, i) => (
              <tr key={i}>
                <td>{mmss(p.t)}</td>
                <td>
                  {p.value} ({p.delta >= 0 ? "+" : "−"}
                  {Math.abs(p.delta)})
                </td>
                <td>{p.said}</td>
                <td>{p.signals.map((s) => s.label).join(", ") || "Nothing notable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
