# Warmup

**Practice the conversations you'd rather avoid.** Talk out loud with AI people who react like real ones: ask a good question and they warm up, give one-word answers and they drift away. Afterwards, replay it and try the hard moment again.

**Try it:** [warmup-assembly.vercel.app](https://warmup-assembly.vercel.app). It needs a microphone, and works on a phone speaker too.

Built for the AssemblyAI Voice Agent Hackathon (September 2026) on AssemblyAI's Voice Agent API (which hears you with the new Universal-3.6 Pro Realtime), Universal-3.5 Pro and LLM Gateway.

## What it does

Seven scenes on a five-level ladder, from low stakes to the moments people dread:

| Level | Scene | You talk to |
| --- | --- | --- |
| 1 | Order a coffee | Jess, a chatty barista |
| 2 | Coffee machine small talk | Marcus, from another team |
| 3 | Talk to a stranger at a party | Sam, at the snack table |
| 4 | The quiet one at a networking event | Daniel, reserved and tired |
| 4 | First date | Theo or Nina |
| 5 | Ask someone out | Lena or Jonah, whose answer depends on you |
| 5 | Speak on the spot | Priya, a meetup host: 90 seconds on a random topic, then two questions |

**While you talk,** a gauge around their portrait shows how interested they are and why: *+8 Followed up on "climbing"*, *−7 Very short answer*. They feel it too. As their interest changes, the app changes their mood mid-conversation, so they open up, or look for an exit and leave.

**Afterwards,** the replay shows how their interest moved, how you sounded (response time, filler words, pace, pauses), coach notes with one thing to try next, and the moments that mattered. **Try this moment again** replays one: the persona says the same line, remembering everything before it, and you answer differently.

## How it uses AssemblyAI

| Product | Used for |
| --- | --- |
| **Voice Agent API** | One WebSocket session per conversation, opened with a temporary token so the key stays on the server. It hears you with Universal-3.6 Pro Realtime. `session.update` changes the persona's mood as their interest moves, and keeps the host quiet while you give a talk. `reply.create` makes the persona leave or wrap up. Word timings from `transcript.agent.delta` sync the captions to the voice. |
| **Sessions API** | The two-channel recording (you on the left, the persona on the right), ready as soon as the session ends. |
| **Universal-3.5 Pro** | Transcribes the recording with `multichannel` and `disfluencies`, so every um, gap and pause is measured from word timings. |
| **LLM Gateway** | Writes the coach notes from the transcript and metrics. |

What we learned building it, with measurements, limits and workarounds: [docs/findings.md](docs/findings.md).

## How it works

```
Browser (Next.js client)                              AssemblyAI
─────────────────────────────────────────────────     ─────────────────────────────────
mic → AudioWorklet (resample to 24 kHz PCM16) ──────► Voice Agent API (WebSocket)
speaker ◄── <audio> ◄── local WebRTC ◄── worklet ◄──────  persona voice + events
engagement model runs after every turn ──session.update / reply.create──►
        │
        └─ session ends → /report/[id]
             POST /api/analysis ──► Sessions API: recording URL ──► Universal-3.5 Pro
             GET  /api/analysis/:id ◄── words, speakers, timings (multichannel + disfluencies)
             POST /api/coach ─────────────────────────────────────► LLM Gateway
```

The server is a few route handlers that hold the API key. They refuse calls that don't come from the app's own page (Vercel BotID) and limit how often each network can start a session, so the public demo needs no login. Practice history stays in the browser, and there is no database. The persona's voice plays through an AudioWorklet, so its 10 ms chunks join without clicks, and through a WebRTC connection inside the page, so phones cancel its echo on speaker. The findings explain both.

The interest gauge follows transparent rules (questions, follow-ups, sharing, answer length, response time, interruptions), so every change can be explained. The personas are a full LLM and react to meaning too.

## Run it

Requires Node 22 or newer.

```bash
npm install
echo "ASSEMBLY_KEY=your_assemblyai_key" > .env
npm run dev                                  # http://localhost:3000
```

The microphone needs `https` or `localhost`. To try it on a phone, `npm run build && npm run start:https` serves the build over HTTPS with a self-signed certificate. On Vercel, set `ASSEMBLY_KEY`. `COACH_MODEL` picks the LLM Gateway model; the default, `qwen3.5-4b-32k-fast`, is the one free accounts can use.

## Tests

The app is tested against the real APIs with no one talking:

- `npm run e2e -- party` holds a real conversation in headless Chrome. A fake microphone speaks lines voiced by the Voice Agent API whenever the app says it's your turn, then the script checks the report. There's a plan for every scene, plus `cold`, where one-word answers drive the persona away. `--mobile` runs at phone size, `--echo` plays the page's audio back into the mic like a phone speaker, and `--retake` tries a moment again.
- `npm run ui-checks` checks the pages and a saved report after `npm run build`, with no voice sessions.
- `npm run player-check` checks that the streamed voice plays back without clicks, on a voice clip cached by an e2e run.

## Notes

Warmup is a practice tool, not therapy. Personas step out of character and point to real help if someone says they're in crisis.

MIT license. Emoji by [OpenMoji](https://openmoji.org), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
