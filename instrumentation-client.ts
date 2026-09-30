import { initBotId } from "botid/client/core";

// The routes that spend AssemblyAI credit. BotID adds an invisible browser check to the page's own
// calls to them, and the routes refuse calls without it (lib/server/aai.ts, requireBrowser).
initBotId({
  protect: [
    { path: "/api/token", method: "GET" },
    { path: "/api/analysis", method: "POST" },
    { path: "/api/coach", method: "POST" },
  ],
});
