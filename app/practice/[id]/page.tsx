import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Practice from "@/components/Practice";
import { SCENES, sceneById } from "@/lib/scenarios";

export function generateStaticParams() {
  return SCENES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: sceneById(id)?.title ?? "Practice" };
}

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scene = sceneById(id);
  if (!scene) notFound();
  // Scenes hold RegExps, so the client component looks the scene up itself.
  return (
    <main>
      <Practice sceneId={scene.id} />
    </main>
  );
}
