import { errorResponse, HttpError, recordingUrl } from "@/lib/server/aai";

export const dynamic = "force-dynamic";

// Returns a fresh, short-lived URL for the session recording (the URLs expire quickly).
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    if (!/^sess_[a-zA-Z0-9]+$/.test(sessionId)) throw new HttpError(400, "Invalid session id.");
    return Response.json({ url: await recordingUrl(sessionId, 5000) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
