// Lists which LLM Gateway models this API key can use right now (free accounts only get
// AssemblyAI's own small model). Set COACH_MODEL in .env to one of the usable ones.
//
//   node --env-file=.env scripts/llm-access.mjs
import { KEY } from "./lib.mjs";

const res = await fetch("https://llm-gateway.assemblyai.com/v1/models", { headers: { authorization: KEY } });
const ids = (await res.json()).data.map((m) => m.id);
const candidates = ids.filter((id) => /claude|gpt-5|gemini-3|qwen3\.5/.test(id));
console.log(`Checking ${candidates.length} of ${ids.length} models (one tiny request each)…`);
for (const model of candidates) {
  const r = await fetch("https://llm-gateway.assemblyai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "Say OK." }] }),
  });
  const j = await r.json().catch(() => ({}));
  const why = r.ok ? "usable" : r.status === 429 ? "rate limited (usable, try again in a minute)" : (j.metadata?.errors ?? [j.message]).join("; ");
  console.log(`${model.padEnd(30)} ${why}`);
}
