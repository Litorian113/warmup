import { errorResponse, mintAgentToken, rateLimit } from "@/lib/server/aai";

export const dynamic = "force-dynamic";

// Mints a single-use Voice Agent token so the browser can open the WebSocket without the API key.
export async function GET(req: Request) {
  try {
    rateLimit(req, "token", 30, 60 * 60 * 1000);
    return Response.json({ token: await mintAgentToken() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
