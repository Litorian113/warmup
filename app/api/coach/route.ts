import { coachMessages, normalizeGoals, parseCoach, type CoachRequest } from "@/lib/coach";
import { chat, COACH_MODEL, errorResponse, HttpError, rateLimit, requireBrowser } from "@/lib/server/aai";
import { sceneById } from "@/lib/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // waits out a short LLM Gateway rate limit, then calls the model

// Written feedback from an LLM via AssemblyAI's LLM Gateway (model set by COACH_MODEL).
export async function POST(req: Request) {
  try {
    rateLimit(req, "coach", 40, 60 * 60 * 1000, (wait) => `Your network has asked for a lot of coach notes in the last hour, more than the demo allows. Reload this page in ${wait} for detailed notes.`);
    await requireBrowser("no coach notes were written");
    const body = (await req.json()) as CoachRequest;
    const scene = sceneById(body.sceneId);
    const persona = scene?.personas.find((p) => p.name === body.personaName) ?? scene?.personas[0];
    if (!scene || !persona) throw new HttpError(400, "Unknown scene.");
    if (typeof body.script !== "string" || body.script.length < 10) throw new HttpError(400, "The transcript is empty.");
    if (body.script.length > 20000) body.script = body.script.slice(0, 20000);

    const messages = coachMessages(scene, persona, body);
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await chat(messages);
      const report = parseCoach(raw, COACH_MODEL);
      if (report) return Response.json({ report: normalizeGoals(report, scene) });
      console.warn(`[coach] unreadable output from ${COACH_MODEL} (attempt ${attempt + 1}):`, raw.slice(0, 400));
    }
    throw new HttpError(502, "The AI coach returned something unreadable.");
  } catch (e) {
    return errorResponse(e);
  }
}
