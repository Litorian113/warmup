// Hand-drawn-style decorations for the home page: props that sit on the ladder's steps, and
// clouds. All purely decorative.

type P = { className?: string };
const svg = (className?: string) => ({ className: `decor${className ? ` ${className}` : ""}`, "aria-hidden": true, focusable: false });
const SPARK = "#f0894c";

export function Cup({ className }: P) {
  return (
    <svg viewBox="0 0 120 110" {...svg(className)}>
      <ellipse cx="58" cy="101" rx="42" ry="6" fill="#b7c8e6" opacity="0.7" />
      <path d="M58 40 C50 30 66 24 58 12" stroke="#c7d1e3" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M88 58 Q108 60 104 76 Q100 88 84 86" stroke="#efe8de" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M26 50 H90 L84 92 Q82 100 72 100 H44 Q34 100 32 92 Z" fill="#fbf8f3" />
      <path d="M26 50 H40 L44 100 Q34 100 32 92 Z" fill="#ece5da" />
      <ellipse cx="58" cy="50" rx="32" ry="7" fill="#f1ebe2" />
      <ellipse cx="58" cy="51" rx="26" ry="4.6" fill="#5a3a28" />
      <g stroke={SPARK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M92 32 L100 18" />
        <path d="M98 42 L112 34" />
        <path d="M99 52 L114 52" />
      </g>
    </svg>
  );
}

/** The sprig drawing (public/backdrops/flower.svg), cropped to its bounds so the stem ends at the bottom edge. */
const SPRIG_BOX = "290 204 678 890";
const Sprig = (p: { x?: number; y?: number; width: number; height: number }) => (
  <svg {...p} viewBox={SPRIG_BOX}>
    <image href="/backdrops/flower.svg" width="1254" height="1254" />
  </svg>
);

/** A single three-leaf sprig. */
export function Plant({ className }: P) {
  return (
    <svg viewBox={SPRIG_BOX} {...svg(className)}>
      <image href="/backdrops/flower.svg" width="1254" height="1254" />
    </svg>
  );
}

/** Two sprigs: a mirrored big one and a small one leaning the other way, so it isn't the same plant twice. */
export function Plants({ className }: P) {
  return (
    <svg viewBox="0 0 160 120" {...svg(className)}>
      <g transform="translate(160 0) scale(-1 1)">
        <Sprig x={44} width={92} height={120} />
      </g>
      <g transform="rotate(16 127 120)">
        <Sprig x={100} y={50} width={54} height={70} />
      </g>
    </svg>
  );
}

export function Bubbles({ className }: P) {
  return (
    <svg viewBox="0 0 150 110" {...svg(className)}>
      <g stroke={SPARK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M18 34 L6 26" />
        <path d="M26 24 L20 10" />
        <path d="M38 20 L38 4" />
      </g>
      <path d="M62 16 H124 Q140 16 140 32 V52 Q140 68 124 68 H118 L122 82 L104 68 H78 Q62 68 62 52 V32 Q62 16 78 16 Z" fill="#f3b39c" />
      <path d="M20 44 H84 Q100 44 100 60 V82 Q100 98 84 98 H48 L32 108 L34 98 Q20 96 20 82 V60 Q20 44 36 44 Z" fill="#90b4ec" />
    </svg>
  );
}

/** The summit: a flag on a little hill whose fill is the step's own tint. */
export function Flag({ className }: P) {
  return (
    <svg viewBox="0 0 170 150" {...svg(className)}>
      <path d="M0 150 C26 96 144 96 170 150 Z" style={{ fill: "var(--tint)" }} />
      <path d="M20 150 C44 110 128 110 150 150 Z" fill="#e6dca4" opacity="0.55" />
      <g fill="#6f977c">
        <path d="M78 116 C74 104 70 100 64 98 C70 106 72 112 72 118 Z" />
        <path d="M90 116 C94 104 98 100 104 98 C98 106 96 112 96 118 Z" />
        <path d="M84 118 C82 104 84 96 86 90 C88 98 90 106 88 118 Z" />
      </g>
      <path d="M84 118 V20" stroke="#262c3a" strokeWidth="5" strokeLinecap="round" />
      <circle cx="84" cy="18" r="4" fill="#262c3a" />
      <path d="M86 22 L136 30 Q124 40 138 52 L86 50 Z" fill="#ee8f8a" />
      <g stroke={SPARK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M58 28 L46 14" />
        <path d="M52 44 L34 40" />
        <path d="M54 60 L38 64" />
      </g>
    </svg>
  );
}

export function Cloud({ className }: P) {
  return (
    <svg viewBox="0 0 200 90" {...svg(className)}>
      <path
        d="M30 82 Q8 82 10 63 Q12 46 32 46 Q36 20 64 20 Q84 20 92 38 Q102 28 118 30 Q140 32 142 54 Q162 52 168 67 Q172 82 150 82 Z"
        fill="#dce6f6"
      />
    </svg>
  );
}

// Soft, lopsided pastel shapes for behind the hero card.
const BLOBS = {
  a: "M112 18 C176 -6 238 40 246 104 C254 170 214 238 146 246 C78 254 12 214 6 146 C0 82 48 42 112 18 Z",
  b: "M86 10 C150 0 210 44 214 112 C218 176 172 232 104 236 C40 240 -4 190 2 122 C8 58 30 18 86 10 Z",
  c: "M130 8 C196 14 246 76 238 142 C230 204 170 246 104 238 C40 230 0 178 8 112 C16 46 70 2 130 8 Z",
};

export function Blob({ className, shape = "a", color }: P & { shape?: keyof typeof BLOBS; color: string }) {
  return (
    <svg viewBox="0 0 252 252" {...svg(className)}>
      <path d={BLOBS[shape]} fill={color} />
    </svg>
  );
}

/** Three short orange strokes, the "look here" marks from the illustrations. */
export function Sparks({ className }: P) {
  return (
    <svg viewBox="0 0 40 40" {...svg(className)}>
      <g stroke={SPARK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M10 30 L2 22" />
        <path d="M20 22 L16 6" />
        <path d="M30 26 L38 14" />
      </g>
    </svg>
  );
}
