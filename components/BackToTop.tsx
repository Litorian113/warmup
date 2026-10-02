"use client";

import { useEffect, useState } from "react";

/** A round button in the corner that scrolls back up, once you're well down a long page. Phones only (globals.css). */
export default function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 1.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "instant" : "smooth" });
  };

  return (
    <button
      type="button"
      className="to-top"
      data-shown={shown}
      onClick={toTop}
      aria-label="Back to top"
      aria-hidden={!shown}
      tabIndex={shown ? undefined : -1}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
