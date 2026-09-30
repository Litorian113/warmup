import { warmthColor } from "@/lib/warmth";

// A ring around whatever sits in the middle (their portrait, or the talk countdown), open at the
// bottom like a speedometer: 0 sits at about seven o'clock, 100 at five. It fills its positioned
// parent, a little outside it, so a portrait's hair can break out over the top of the ring.
const SWEEP = 270;

/** The arc's shape, as a mask for the gradient ring. `stroke` is in % of the gauge's width. */
function arcMask(stroke: number) {
  const r = 50 - stroke / 2;
  const at = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(50 + r * Math.sin(rad)).toFixed(2)} ${(50 - r * Math.cos(rad)).toFixed(2)}`;
  };
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M${at(-SWEEP / 2)} A${r} ${r} 0 1 1 ${at(SWEEP / 2)}' fill='none' stroke='black' stroke-width='${stroke}' stroke-linecap='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export default function InterestGauge({ value, label, stroke = 3 }: { value: number; label: string; stroke?: number }) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div
      className="gauge"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      style={
        {
          "--gauge-at": `${(v / 100) * SWEEP}deg`,
          "--gauge-stroke": stroke,
          "--gauge-mask": arcMask(stroke),
          "--room": warmthColor(v),
        } as React.CSSProperties
      }
    >
      <span className="gauge__knob" />
    </div>
  );
}
