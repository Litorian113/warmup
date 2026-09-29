import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap center-state">
      <h1 className="h2">This page doesn&rsquo;t exist</h1>
      <p className="lede">The scene or replay you were looking for isn&rsquo;t here. Pick a scene to practice instead.</p>
      <Link className="btn" href="/#scenes">
        Choose a scene
      </Link>
    </main>
  );
}
