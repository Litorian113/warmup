import { warmthColor } from "@/lib/warmth";

export default function WarmthMeter({ value, label, note }: { value: number; label: string; note?: string }) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">{label}</span>
        <span className="meter__value">{note ?? `${v} / 100`}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        style={{ "--at": `${v}%`, "--room": warmthColor(v) } as React.CSSProperties}
      >
        <span className="meter__knob" />
      </div>
    </div>
  );
}
