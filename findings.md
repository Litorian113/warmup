# What we learned building on AssemblyAI

Findings from building Warmup on AssemblyAI's Voice Agent API, Sessions API, Universal-3.5 Pro and LLM Gateway, in September 2026, on a free-tier account. Each entry says what we found, how we know, and what the app does about it. Add new findings to the section they belong to.

## At a glance

| What | Measured |
| --- | --- |
| Reply latency, end of your speech to the agent's first audio | 1.1 to 2.9 s, usually 1.5 to 2 s |
| Session recording available | right after the session ends |
| Transcribing the two-channel recording | 8 to 16 s per minute of audio |
| LLM Gateway on a free account | one model, 2 requests per minute |
| Agent audio stream | 10 ms chunks, about 110 ms ahead of real time |
| Routing the agent's voice as WebRTC call audio | connects in about 0.1 s, adds about 30 ms |

## Voice Agent API

**The greeting is spoken word for word, so it doubles as text-to-speech.** A session's `greeting` is read out verbatim before anyone talks. Our test scripts voice the "user" this way: open a throwaway session with the line as its greeting, keep the `reply.audio` chunks, and save a WAV. No separate TTS service needed. (`scripts/lib.mjs`, `tts()`)

**Replies start 1.1 to 2.9 seconds after the user stops talking.** Measured end to end in headless Chrome, from the end of our spoken line to the first `reply.audio`, in the default `balanced` mode with adaptive turn detection. Most turns land at 1.5 to 2 s; the slowest we saw was 4.9 s.

**The persona can change its mood mid-session.** After `session.ready`, `system_prompt`, `input.turn_detection`, `input.keyterms`, `input.transcription_prompt`, `input.transcription_mode` and `output.volume` can still change. `greeting`, `output.voice` and `output.format` can't; changing them returns `immutable_field`. We rewrite the mood line in the persona's system prompt when the warmth meter crosses a band, and the next reply follows it.

**`max_silence` tops out at 10 seconds.** Higher values fail with `invalid_value 'input.turn_detection.max_silence' must be between 50 and 10000 ms`. So the agent can't be told to stay quiet through a 90-second talk. During the talk we set `min_silence: 6000, max_silence: 10000` and don't play the replies that still come, which are usually "Mm."

**The recording has everything the agent said, including replies the client never played.** Muting a reply on the client doesn't keep it out of the recording or the transcript. That's why the talk mode raises the silence thresholds instead of only muting.

**A reply can already be on its way when you change course.** Right after switching from the talk to the Q&A, a muted "Mm." can still arrive. The app unmutes on the next `reply.started`, not straight away.

**The agent's LLM follows one step at a time better than a plan.** Told to ask two questions, the host often wrapped up after the first answer. Updating the system prompt after each question ("you've asked one, now ask the second") made it reliable.

**Word timings make synced captions easy.** `transcript.agent.delta` carries `start_ms`, each word's offset into the reply audio, so captions can appear as the words are spoken. When a reply is cut off, `transcript.agent` has `interrupted: true` and the text trimmed to what was actually heard.

**Finishing your sentence after a pause can count as interrupting.** In `balanced` mode a barge-in needs 500 ms of speech (`interruption_delay`). If the user pauses, the agent starts answering and the user carries on, the agent is cut off. The app doesn't score a cut-in within 1.5 s of the reply starting as "talking over them".

**On a phone speaker the agent heard itself.** The docs say browser clients work hands-free because `getUserMedia` cancels echo. That holds on desktop Chrome, which cancels everything it plays. On the phone we tested, though, the persona's voice (played through Web Audio) reached the mic, and the agent cut itself off on every reply. A simulation reproduces it: 9 cut-offs in a row. Two fixes now make it work on that phone:
- The voice goes through a WebRTC connection inside the page and plays from an `<audio>` element. That makes it call audio, which is what phone browsers reliably cancel.
- If echo still gets through, a guard mutes the mic while the persona talks, and the room says so.

We haven't yet recorded which of the two did the job on that phone. (`lib/voice/audio.ts`, `lib/voice/echo.ts`)

**Agent audio arrives in 10 ms chunks, about 110 ms ahead of real time.** Every `reply.audio` event carried exactly 10 ms (240 samples at 24 kHz), 100 a second, and the server keeps roughly 110 ms queued ahead of playback. Scheduling each chunk as its own `AudioBufferSourceNode` in a 44.1 or 48 kHz context clicked at the joins, because the browser resamples each buffer on its own. Rendering a real reply in Chromium, 130 of 372 joins glitched at 44.1 kHz, with spikes up to 0.8 of full scale, and 31 did at 48 kHz. On a MacBook it sounded like crackling. A playback AudioWorklet that resamples the stream continuously gives output identical, sample for sample, to one long buffer. (`public/worklets/player-processor.js`, `scripts/player-check.mjs`)

**The live transcript drops most filler words.** `transcript.user` rarely contained "um" or "uh" even when the audio did. Filler counts come from transcribing the recording with `disfluencies: true` instead.

**Voice names don't tell you how a voice sounds.** We measured each voice's median pitch and matched voices to personas by that, not by name. (`scripts/voice-pitch.mjs`)

| Voice | Median pitch |
| --- | --- |
| `charles` | 78 Hz |
| `michael` | 94 Hz |
| `jean` | 100 Hz |
| `paul` | 113 Hz |
| `alba` | 122 Hz |
| `george` | 128 Hz |
| `vera` | 171 Hz |
| `mary` | 190 Hz |
| `anna` | 197 Hz |
| `jane` | 212 Hz |
| `eve` | 218 Hz |

**End every session explicitly.** Without `session.end`, a dropped connection stays resumable for 30 s, and that time is billed. The app sends `session.end` on every exit, including `pagehide`.

**Audio has to arrive in real time.** Sending `input.audio` faster than real time is an `audio_rate_violation`, so scripts that stream recorded audio pace it.

**Tokens keep the key off the client, and auth headers differ by product.** The server mints a single-use token (`expires_in_seconds: 60` to connect, `max_session_duration_seconds: 600` to cap the session), and the browser only ever sees the token. The token endpoint wants `Authorization: Bearer <key>`. Our calls to the Sessions API, pre-recorded STT and LLM Gateway send the raw key.

## Sessions API

**The recording is ready as soon as the session ends.** `GET /v1/sessions/{id}` returns a stereo OGG (left = user, right = agent) and a timeline. The server polls for up to 15 s, but we haven't needed to wait.

**The recording URL goes straight into transcription.** The artifact URL is pre-signed, and `POST /v2/transcript` accepts it as `audio_url`, so nothing is downloaded or uploaded again. The URLs expire quickly, so the report asks the server for a fresh one before playback.

## Universal-3.5 Pro (pre-recorded)

**Two channels beat speaker diarization here.** With `multichannel: true` every word carries its channel, so "you" and "them" are never mixed up.

**Transcription takes 8 to 16 seconds per minute of two-channel audio**, measured from submitting the job to `completed`.

**`disfluencies: true` keeps "um" and "uh"**, which the filler metrics need.

**It hears listening noises in silence.** The transcript contains "mm", "mhm" and "m" where nobody spoke, on both channels. Left in, they inflated the filler count and invented pauses, so they're dropped before anything is measured. (`lib/metrics.ts`)

**The synthetic voice's breaths come out as fillers.** The agent's channel sometimes gets "um" or "uh", so fillers on that channel are ignored.

**Multichannel utterances aren't turns.** Each channel is split into utterances without regard to the other speaker:
- One of the user's utterances ran from 21 s to 57 s, across several of the persona's lines.
- Another stopped mid-sentence, with its last word ("it?") placed at the start of the user's next turn.
- A 51-second talk came back as three utterances, split at pauses of 0.6 s and 1.0 s.

As a result, any metric calculated per utterance was off. Pauses at the splits went uncounted, and answer lengths depended on where the splits fell. The app rebuilds turns from the word timings: a turn runs on until the other speaker starts talking in one of its pauses. (`lib/metrics.ts`, `toTurns`)

## LLM Gateway

**Free accounts get one model.** LLM Gateway isn't covered by the free credits. Every model except `qwen3.5-4b-32k-fast` answers HTTP 400 with "Your account does not have access to this LLM Gateway model".

**The models list doesn't tell you what you can use.** It lists every model regardless of access, so `npm run llm-access` tries each one.

**2 requests per minute, and rejected requests count too.** 429 responses come with `retry-after` and `x-ratelimit-*` headers, and they count against the window: `x-ratelimit-remaining` went down to −7. Retrying in a loop makes it worse. The report waits for `retry-after` and shows rule-based notes in the meantime.

**The small model has no `response_format`.** Ask for JSON in the prompt instead. `post_processing_steps: [{ type: "json-repair" }]` fixes most broken JSON, but we saw 5xx errors with it switched on, so the server retries without it and repairs locally. The model also produces shapes like `"id": "long": true`; objects keyed by id parse more reliably than arrays. (`lib/coach.ts`, `lib/server/aai.ts`)

## Browser integration

**The microphone needs HTTPS.** Browsers only allow `getUserMedia` on https or localhost. To test on a phone over Tailscale we serve the production build over HTTPS with a self-signed certificate (`npm run start:https`).

**In-page WebRTC defaults to 32 kbit/s Opus.** For call audio that never leaves the device, the page adds `maxaveragebitrate=96000` to the Opus `fmtp` line in the answer. We measured the target going from 32000 to 96000, and continuous audio from 30 to 97 kbit/s. The in-page connection is otherwise clean: in a 60-second conversation, about 40 ms was concealed (once, while connecting), with no lost packets and a 32 ms jitter buffer.

## Testing without a human

**The whole app can be tested against the real APIs with no one talking.** The e2e script combines greeting-based TTS with a fake microphone in headless Chrome. It holds real conversations: it speaks each line when the app shows "Your turn", then checks the report. `--echo` feeds the page's own audio back into the mic to reproduce the phone-speaker problem. The fake mic bypasses the browser's echo canceller, so echo cancellation itself can only be checked on a real device.
