// Warmth (0-100) as a temperature color: frost blue -> lilac -> amber -> blush.
// Used for the live room, the meter, and the report's warmth curve.

export const WARMTH_STOPS: [number, string][] = [
  [0, "#6f9bd1"],
  [40, "#a99fd3"],
  [66, "#ffb547"],
  [100, "#f25c7a"],
];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function warmthColor(v: number): string {
  const x = Math.max(0, Math.min(100, v));
  for (let i = 1; i < WARMTH_STOPS.length; i++) {
    const [p1, c1] = WARMTH_STOPS[i];
    const [p0, c0] = WARMTH_STOPS[i - 1];
    if (x <= p1) {
      const t = (x - p0) / (p1 - p0);
      const a = rgb(c0);
      const b = rgb(c1);
      return `#${a.map((ch, k) => Math.round(ch + (b[k] - ch) * t).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return WARMTH_STOPS[WARMTH_STOPS.length - 1][1];
}

export const warmthGradient = `linear-gradient(90deg, ${WARMTH_STOPS.map(([p, c]) => `${c} ${p}%`).join(", ")})`;
