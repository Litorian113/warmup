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

export function Plant({ className }: P) {
  return (
    <svg viewBox="0 0 120 92" {...svg(className)}>
      <g>
        <path d="M60 90 C36 76 22 50 30 26 C48 40 60 64 60 90 Z" fill="#8fb09b" />
        <path d="M60 90 C84 76 98 50 90 26 C72 40 60 64 60 90 Z" fill="#7aa086" />
        <path d="M60 90 C48 64 46 34 60 8 C74 34 72 64 60 90 Z" fill="#5f8a70" />
        <path d="M60 90 C40 84 16 78 6 60 C28 56 48 70 60 90 Z" fill="#a4c2ad" />
        <path d="M60 90 C80 84 104 78 114 60 C92 56 72 70 60 90 Z" fill="#94b6a0" />
      </g>
      <g stroke="#4c7560" strokeWidth="1.6" fill="none" opacity="0.5">
        <path d="M60 86 Q58 50 60 16" />
        <path d="M58 86 Q44 60 34 32" />
        <path d="M62 86 Q76 60 86 32" />
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
