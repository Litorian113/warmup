import { errorResponse, getTranscript, HttpError } from "@/lib/server/aai";

export const dynamic = "force-dynamic";

// Polls a transcription job; once complete, returns only what the report needs.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new HttpError(400, "Invalid transcript id.");
    const t = await getTranscript(id);
    if (t.status === "error") throw new HttpError(502, `Transcription failed: ${t.error}`);
    if (t.status !== "completed") return Response.json({ status: t.status });
    return Response.json({
      status: "completed",
      id: t.id,
      audioDuration: t.audio_duration,
      utterances: (t.utterances ?? []).map((u: any) => ({
        channel: u.channel,
        start: u.start,
        end: u.end,
        text: u.text,
        words: (u.words ?? []).map((w: any) => ({ text: w.text, start: w.start, end: w.end })),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
