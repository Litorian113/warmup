// Server-only AssemblyAI helpers. The API key never leaves the server.
import { checkBotId } from "botid/server";

export function apiKey() {
  const key = process.env.ASSEMBLY_KEY ?? process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new HttpError(500, "The server is missing its AssemblyAI key (set ASSEMBLY_KEY).");
  return key;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    const headers = e.retryAfter ? { "retry-after": String(e.retryAfter) } : undefined;
    return Response.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status, headers });
  }
  console.error(e);
  return Response.json({ error: "Something went wrong on the server." }, { status: 500 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Voice Agent API ----------

export async function mintAgentToken() {
  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "60");
  // Hard cap per practice session, so a token is worth little to anyone who isn't practicing. The
  // persona wraps up a minute before it (lib/conversation.ts).
  url.searchParams.set("max_session_duration_seconds", "300");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey()}` }, cache: "no-store" });
  if (!res.ok) {
    console.error(`[token] AssemblyAI answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (res.status === 429) throw new HttpError(503, "More people are practicing right now than the voice service allows at once. Try again in a minute.", 60);
    if ([401, 402, 403].includes(res.status)) throw new HttpError(503, "The voice service isn't accepting new sessions from this demo right now. Try again later.");
    throw new HttpError(502, "The voice service didn't answer. Try again in a moment.");
  }
  return (await res.json()).token as string;
}

interface AgentSession {
  id: string;
  status: string;
  duration_seconds?: number;
  artifacts?: { type: string; url: string }[];
}

export async function getAgentSession(id: string): Promise<AgentSession> {
  const res = await fetch(`https://agents.assemblyai.com/v1/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: apiKey() },
    cache: "no-store",
  });
  if (res.status === 404) throw new HttpError(404, "That session doesn't exist (or was deleted).");
  if (!res.ok) throw new HttpError(502, `AssemblyAI couldn't load the session (${res.status}).`);
  return res.json();
}

/** Artifacts appear once the session completes; wait a little for them. */
export async function recordingUrl(sessionId: string, waitMs = 15000) {
  const until = Date.now() + waitMs;
  for (;;) {
    const s = await getAgentSession(sessionId);
    const audio = s.artifacts?.find((a) => a.type === "audio")?.url;
    if (audio) return audio;
    if (Date.now() > until) throw new HttpError(409, "The recording isn't ready yet. Try again in a few seconds.", 5);
    await sleep(1000);
  }
}

// ---------- Pre-recorded STT ----------

export async function submitTranscript(audioUrl: string, keyterms: string[]) {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: apiKey(), "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl, // the pre-signed recording URL; AssemblyAI fetches it directly
      speech_models: ["universal-3-5-pro", "universal-2"],
      multichannel: true, // left = user, right = persona
      disfluencies: true, // keep "um", "uh" so we can count them
      keyterms_prompt: keyterms.slice(0, 50),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new HttpError(502, `Transcription request failed: ${json.error ?? res.status}`);
  return json.id as string;
}

export async function getTranscript(id: string) {
  const res = await fetch(`https://api.assemblyai.com/v2/transcript/${encodeURIComponent(id)}`, {
    headers: { authorization: apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new HttpError(502, `Couldn't load the transcript (${res.status}).`);
  return res.json();
}

// ---------- LLM Gateway ----------

export const COACH_MODEL = process.env.COACH_MODEL ?? "qwen3.5-4b-32k-fast";

export async function chat(messages: { role: "system" | "user"; content: string }[], maxTokens = 1800) {
  let waited = false;
  let repair = true;
  for (;;) {
    const res = await fetch("https://llm-gateway.assemblyai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: apiKey(), "content-type": "application/json" },
      body: JSON.stringify({
        model: COACH_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
        // The Gateway fixes small JSON slips before we parse; if the repair step itself fails,
        // we retry without it and repair locally instead.
        ...(repair ? { post_processing_steps: [{ type: "json-repair" }] } : {}),
      }),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 30);
      if (!waited && wait <= 20) {
        waited = true;
        await sleep(wait * 1000 + 250);
        continue;
      }
      throw new HttpError(429, "The AI coach is busy right now.", wait);
    }
    const json = await res.json().catch(() => ({}));
    if (res.status >= 500 && repair) {
      repair = false;
      continue;
    }
    if (!res.ok) throw new HttpError(502, `The AI coach is unavailable: ${json.metadata?.errors?.join("; ") ?? json.message ?? res.status}`);
    return String(json.choices?.[0]?.message?.content ?? "");
  }
}

// ---------- Abuse protection for the public demo ----------
// No login: BotID refuses calls that don't come from the app's own page, and a per-IP limit caps
// the rest. The limit lives in each server instance's memory, so it's a backstop; the Vercel
// firewall's rate limit rule is the one that holds across instances.

/** Refuses scripted calls, with BotID's invisible browser check. It only works on Vercel, so
 *  elsewhere (tests, the phone server) everyone passes, and BOTID_SIMULATE=BAD-BOT plays a bot. */
export async function requireBrowser(consequence: string) {
  let isBot = process.env.BOTID_SIMULATE === "BAD-BOT";
  if (process.env.VERCEL) {
    try {
      isBot = (await checkBotId()).isBot;
    } catch (e) {
      // If the check itself breaks (say, the project's OIDC token is missing), let visitors in
      // rather than lock everyone out; the rate limit still applies.
      console.error("[botid] check failed, letting the request through:", e);
    }
  }
  if (isBot)
    throw new HttpError(
      403,
      `Warmup couldn't confirm this came from its page in a browser, so ${consequence}. Reload the page and try again. If an extension blocks scripts here, allow them for this site.`,
    );
}

/** "about 14 minutes", for a wait in seconds. */
export const waitText = (s: number) => {
  const m = Math.max(1, Math.ceil(s / 60));
  return m === 1 ? "about a minute" : `about ${m} minutes`;
};

const hits = new Map<string, number[]>();
/** Per-IP limit. `tooMany` gets the wait ("about 14 minutes") and says what happened. */
export function rateLimit(req: Request, bucket: string, max: number, windowMs: number, tooMany: (wait: string) => string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    throw new HttpError(429, tooMany(waitText(retryAfter)), retryAfter);
  }
  recent.push(now);
  hits.set(key, recent);
}
