import type { Scene } from "@/lib/scenarios";

/** `openLabel` marks the goals not reached yet, e.g. "Next time" on the report. */
export default function GoalList({
  scene,
  done,
  inline,
  openLabel,
}: {
  scene: Scene;
  done: Record<string, boolean>;
  inline?: boolean;
  openLabel?: string;
}) {
  return (
    <ul className={`goals${inline ? " goals--inline" : ""}`}>
      {scene.goals.map((g) => (
        <li key={g.id} className={`goal${done[g.id] ? " is-done" : ""}`}>
          <span className="goal__mark" aria-hidden="true">
            {done[g.id] && (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M2 6.5 4.8 9 10 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="goal__text">
            {g.label}
            {done[g.id] && <span className="sr-only"> (done)</span>}
          </span>
          {openLabel && !done[g.id] && <span className="goal__open">{openLabel}</span>}
        </li>
      ))}
    </ul>
  );
}
