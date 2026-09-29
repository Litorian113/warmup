import type { Scene } from "@/lib/scenarios";

export default function GoalList({ scene, done }: { scene: Scene; done: Record<string, boolean> }) {
  return (
    <ul className="goals">
      {scene.goals.map((g) => (
        <li key={g.id} className={`goal${done[g.id] ? " is-done" : ""}`}>
          <span className="goal__mark" aria-hidden="true">
            {done[g.id] && (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="goal__text">
            {g.label}
            {done[g.id] && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
