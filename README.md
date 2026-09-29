# Warmup

**Practice the conversations you'd rather avoid.** Talk out loud with AI people who react like real ones: ask a good question and they warm up, give one-word answers and they drift away. Afterwards you get a replay of what worked and what to try next.

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai) (September 2026) on AssemblyAI's Voice Agent API, Universal-3.5 Pro and LLM Gateway.

## What it does

**Seven scenes on a five-level ladder**, from low stakes to the moments people dread, the way exposure practice works:

| Level | Scene | You talk to | Practice |
| --- | --- | --- | --- |
| 1 | Order a coffee | Jess, a chatty barista | Order, answer small talk, ask something back |
| 2 | Coffee machine small talk | Marcus, a coworker from another team | Ask about the weekend, share yours, find common ground |
| 3 | Talk to a stranger at a party | Sam, at the snack table | Learn their name, find common ground, leave gracefully |
| 4 | The quiet one at a networking event | Daniel, reserved and tired | Get a stranger talking, leave with a way to follow up |
| 4 | First date | Nina or Theo (you choose) | Skip the interview, share real stories |
| 5 | Ask someone out | Lena or Jonah (you choose) | Keep it going, then ask. Their answer depends on you |
| 5 | Speak on the spot | Priya, a meetup host | 90 seconds on a random topic, then two audience questions |

**During the conversation**
- A warmth meter reacts after every one of your turns, with the reason: *+8 Followed up on "climbing"*, *−7 Very short answer*, *+2 Used their name*.
- The persona feels it too. When warmth crosses a mood band, the app rewrites the mood line in the persona's system prompt mid-session, so they open up or start looking for an exit. Let it drop too far and they excuse themselves and leave.
- Captions are synced word by word to the voice, and goals tick off as you reach them. Optional hints suggest what to say next.

**Afterwards: the replay**
- A warmth curve over the conversation, with the moments the coach picked pinned to it.
- Speaking metrics measured from the recording, word by word: response time, share of talking, questions asked, filler words per minute (um and uh are kept), pace and pauses.
- Coach notes: what worked, what to try next time, and a line you could have said instead.
- The full transcript with filler words highlighted. Click any time to hear that moment.
- **Try this moment again:** the persona says the exact same line again, remembering everything before it. You answer differently and see how the two attempts compare.

## How it uses AssemblyAI

| Product | What Warmup does with it |
| --- | --- |
| **Voice Agent API** | One WebSocket per practice session, configured inline per scene: persona prompt, exact greeting, voice, `transcription_prompt` and `keyterms`. Browser auth uses single-use temporary tokens. |
| `session.update` mid-session | Swaps the persona's mood as warmth changes. In talk mode it raises turn-detection silence thresholds so the host stays quiet during your talk, then walks the host through a two-question Q&A step by step. |
| `reply.create` | The persona leaves when warmth collapses, wraps up long sessions, and starts the Q&A. |
| Events | `input.speech.*` for response latency and talk detection; `transcript.agent.delta` word timings for captions synced to playback; `reply.done` status for barge-in handling. |
| **Sessions API** | The stereo recording (left = you, right = persona) and conversation timeline, available right after the session ends. |
| **Universal-3.5 Pro** (pre-recorded) | Transcribes the recording with `multichannel` and `disfluencies`, straight from the pre-signed recording URL. Every word gets a speaker and exact timing, so filler words, pace, response gaps and pauses are measured, not guessed. |
| **LLM Gateway** | Writes the coach notes from the transcript and metrics. The `json-repair` post-processing step keeps small models' JSON parseable. |

Text-to-speech for the test harness also comes from the Voice Agent API: a session's `greeting` is spoken verbatim, so the scripts use it to voice the "user" side.

## Architecture

```
Browser (Next.js client)                              AssemblyAI
─────────────────────────────────────────────────     ─────────────────────────────────
mic → AudioWorklet (resample to 24 kHz PCM16) ──────► Voice Agent API (WebSocket)
speaker ◄── <audio> ◄── local WebRTC ◄── playback ◄─────  persona voice + events
engagement model runs after every turn ──session.update / reply.create──►
        │
        └─ session ends → /report/[id]
             POST /api/analysis ──► Sessions API: recording URL ──► Universal-3.5 Pro
             GET  /api/analysis/:id ◄── words, speakers, timings (multichannel + disfluencies)
             POST /api/coach ─────────────────────────────────────► LLM Gateway
```

The server is a handful of route handlers that hold the API key: token minting, analysis start and poll, coach, and fresh recording URLs. Practice history lives in the browser's localStorage, and recordings stay in the AssemblyAI account. There is no database.

### Talking on a phone speaker

A voice agent on a speaker hears itself unless the browser cancels the echo, and phone browsers only reliably cancel echo from call audio. Played through Web Audio, the persona's voice leaked into the mic, and the agent kept cutting itself off mid-sentence. Two fixes (`lib/voice/audio.ts`, `lib/voice/echo.ts`):

- **Call audio.** The voice goes through a WebRTC connection inside the page (two `RTCPeerConnection`s, no server) and plays from an `<audio>` element, so the echo canceller treats it like the other side of a call. It connects in about 0.1 s and adds about 30 ms. If it fails, playback falls back to Web Audio.
- **Echo guard.** While the persona gives their greeting, the mic is muted and the guard checks whether the mic level rises and falls with the voice that is playing. If it does, the echo is getting through, and for the rest of the session the mic is muted while the persona talks, with a note on screen saying so. Otherwise the mic stays open and you can interrupt as usual. The guard keeps checking in case the echo starts later, for example when headphones come out.

## Run it

Requires Node 22 or newer.

```bash
npm install
echo "ASSEMBLY_KEY=your_assemblyai_key" > .env    # ASSEMBLYAI_API_KEY also works
npm run dev                                       # http://localhost:3000
```

Browsers only allow the microphone on `https` or `localhost`. To open the app from another machine (for example over Tailscale), serve the production build over HTTPS with a self-signed certificate:

```bash
npm run build && npm run start:https              # https://<host>:3443, accept the certificate warning once
```

**Deploy:** any Node host works. On Vercel, import the repo and set `ASSEMBLY_KEY` (and optionally `COACH_MODEL`).

### The coach model

`COACH_MODEL` picks the LLM Gateway model for the coach notes. The default is `qwen3.5-4b-32k-fast`, the only Gateway model free accounts can use. LLM Gateway isn't covered by the free credits, and that model is limited to 2 requests per minute. With a funded account, set `COACH_MODEL=claude-sonnet-4-6` (or any model `npm run llm-access` lists as usable) for richer notes. If the coach is busy or unavailable, the report falls back to rule-based notes and retries on its own.

## Test harness

Everything in `scripts/` runs against the real APIs (`node --env-file=.env scripts/<name>.mjs`):

| Script | What it does |
| --- | --- |
| `e2e.mjs <plan> [--retake] [--mobile] [--echo]` | Runs the production build in headless Chromium with a fake microphone that speaks text-to-speech lines whenever the app says it's your turn. It exercises the real mic worklet, WebSocket, playback, engagement model and report pipeline, and saves screenshots. Plans: `cafe`, `coworker`, `party`, `networking`, `first-date`, `ask-out` (a warm chat, then the ask), `cold` (one-word answers until the persona walks away) and `stage`. `--retake` also replays a flagged moment; `--mobile` runs the session at phone size; `--echo` plays everything the page outputs back into the mic, like a phone on speaker (the fake mic skips the browser's echo canceller, so this tests the echo guard). |
| `ui-checks.mjs` | Fast checks with no voice sessions (no API cost): the ladder, the persona choice, the blocked-microphone message, 404 pages, and no horizontal scroll on phones. |
| `simulate.mjs` | A scripted user talking to a persona at real-time pace, printing per-turn latency. |
| `analyze.mjs <session_id>` | Fetches a session's recording and transcribes it with multichannel and disfluencies. |
| `voice-pitch.mjs` | Measures each voice's pitch, used to match voices to persona genders. |
| `llm-access.mjs` | Lists which LLM Gateway models your key can use. |

What we measured with it:
- **Reply latency:** 1.5 to 2 seconds from the end of the user's speech to the persona's first audio, in the default `balanced` transcription mode.
- **Recording:** available right after the session ends.
- **Transcription:** 8 to 16 seconds for a one-minute two-channel recording.
- **Filler words:** in our tests the live transcript mostly drops them, but `disfluencies` on the recording keeps them.
- **Echo:** with `--echo`, the app without the echo guard cut the persona off on every reply, 9 times in a row, and never got to the user's turn. With the guard, the café and stage runs had no cut-offs. Without the echo, the guard keeps the mic open, and interrupting still works.

## Project layout

```
app/                  pages (home, practice, report) and API routes
components/           Practice (briefing + live room), Report, WarmthChart, WarmthMeter, …
lib/scenarios.ts      scenes, personas, goals, persona and host prompts
lib/engagement.ts     the live engagement model (signals, goals, hints)
lib/conversation.ts   the live session engine (events → turns → warmth → mood updates)
lib/voice/            Voice Agent WebSocket client, mic capture and playback
lib/metrics.ts        speaking metrics from the multichannel transcript
lib/coach.ts          coach prompt, tolerant JSON parsing, rule-based fallback
lib/retake.ts         rebuilding a moment for "Try this moment again"
lib/server/aai.ts     server-side AssemblyAI calls (the API key never reaches the browser)
public/worklets/      the AudioWorklet that captures and resamples the mic
scripts/              test harness
```

## Notes and limits

- Warmup is a practice tool, not therapy. Personas are instructed to step out of character and point to real help if someone says they're in crisis.
- The engagement model uses transparent rules (questions, follow-ups, sharing, answer length, response time, talking over them) so every change can be explained. The personas themselves are a full LLM, so they react to meaning too.
- Voices: English personas use the Voice Agent API's English voices, matched to each persona's gender by measured pitch.

## License

MIT
