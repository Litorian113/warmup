import { errorResponse, HttpError, recordingUrl, submitTranscript } from "@/lib/server/aai";
import { sceneById } from "@/lib/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // waits up to 15 s for the session recording

// Starts the post-session transcription of the stereo recording (left = user, right = persona).
export async function POST(req: Request) {
  try {
    const { sessionId, sceneId } = await req.json();
    if (typeof sessionId !== "string" || !/^sess_[a-zA-Z0-9]+$/.test(sessionId)) throw new HttpError(400, "Missing or invalid session id.");
    const scene = sceneById(String(sceneId));
    const audio = await recordingUrl(sessionId);
    const transcriptId = await submitTranscript(audio, scene?.keyterms ?? []);
    return Response.json({ transcriptId });
  } catch (e) {
    return errorResponse(e);
  }
}
