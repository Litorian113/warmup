import { mmss } from "@/lib/metrics";

// Shared playback state for the report: every play button toggles between playing from its spot
// and pausing, so the chart, the moments and the transcript all agree on what's playing.

export interface Playback {
  /** The spot (seconds into the recording) playback was last started from, if any. */
  spot: number | null;
  playing: boolean;
}

/** Normalizes a spot so a button and the playback state compare equal. */
export const spotOf = (t: number) => Math.max(0, Math.round(t * 10) / 10);

export const isPlayingFrom = (pb: Playback | undefined, t: number) => !!pb?.playing && pb.spot === spotOf(t);

export function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 1.2v7.6L8.6 5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 1.2h2.2v7.6H2zM5.8 1.2H8v7.6H5.8z" fill="currentColor" />
    </svg>
  );
}

/** Plays from `at`, or pauses if playback is already running from there. */
export function PlayButton({
  at,
  playback,
  onToggle,
  disabled,
  className = "play",
}: {
  at: number;
  playback: Playback;
  onToggle: (t: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const active = isPlayingFrom(playback, at);
  return (
    <button
      className={`${className}${active ? " is-playing" : ""}`}
      onClick={() => onToggle(at)}
      disabled={disabled}
      aria-label={active ? `Pause, playing from ${mmss(at)}` : `Play from ${mmss(at)}`}
    >
      {active ? <PauseIcon /> : <PlayIcon />} {mmss(at)}
    </button>
  );
}
