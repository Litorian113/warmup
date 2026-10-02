import type { Metadata } from "next";
import BackToTop from "@/components/BackToTop";
import Report from "@/components/Report";

export const metadata: Metadata = { title: "Your replay" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <Report id={id} />
      <BackToTop />
    </main>
  );
}
