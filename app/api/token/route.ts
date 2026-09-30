import { errorResponse, mintAgentToken, rateLimit, requireBrowser } from "@/lib/server/aai";

export const dynamic = "force-dynamic";

// Mints a single-use Voice Agent token so the browser can open the WebSocket without the API key.
export async function GET(req: Request) {
  try {
    rateLimit(req, "token", 20, 60 * 60 * 1000, (wait) => `Your network has started 20 practice sessions in the last hour, the most the demo allows. You can start another in ${wait}.`);
    await requireBrowser("the session didn't start");
    return Response.json({ token: await mintAgentToken() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
