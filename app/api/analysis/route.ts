import { errorResponse, HttpError, rateLimit, recordingUrl, requireBrowser, submitTranscript } from "@/lib/server/aai";
import { sceneById } from "@/lib/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // waits up to 15 s for the session recording

// Starts the post-session transcription of the stereo recording (left = user, right = persona).
export async function POST(req: Request) {
  try {
    // generous: the report asks again while the recording isn't ready yet
    rateLimit(req, "analysis", 60, 60 * 60 * 1000, (wait) => `Your network has asked for a lot of replays in the last hour, more than the demo allows. Reload this page in ${wait} to finish this one.`);
    await requireBrowser("the recording wasn't analyzed");
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
