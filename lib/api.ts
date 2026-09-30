// Readable errors for failed calls to the app's own API routes.

/** The server's JSON body, or {} when there's none (a firewall page, a crash). */
export async function json(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Our routes explain themselves in `error`. Responses that come from Vercel's firewall rather
 *  than our code (its rate limit rule) don't, so say what they mean. */
export function apiError(res: Response, body: { error?: unknown }, failed: string): string {
  if (typeof body.error === "string" && body.error) return body.error;
  if (res.status === 429) return "Your network has sent a lot of requests in the last few minutes, more than the demo allows. Wait a few minutes, then try again.";
  if (res.status === 403) return `${failed}: the request was blocked. Reload the page and try again.`;
  return `${failed} (error ${res.status}). Try again in a moment.`;
}
