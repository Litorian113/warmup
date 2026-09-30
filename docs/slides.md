# Slides

Use a clean, friendly visual style that matches the app: light backgrounds, dark navy text (#1d2433), white rounded cards and generous spacing. Soft pastels mark the five levels: blue (#dce8f8), green (#dcebe0), peach (#fae2d4), lilac (#e8e2f5) and butter (#f8edcf). Small hand-drawn props (a coffee cup, leafy sprigs, speech bubbles, a flag on a hill) and OpenMoji emoji keep it warm, never busy. The interest gradient, cool blue (#6f9bd1) through violet (#a99fd3) and amber (#ffb547) to pink (#f25c7a), always and only shows how interested the other person is. Headlines in Recursive, bold and slightly casual. Jess, the barista, is the face of the deck: an illustrated portrait ringed by the interest gauge. Use the app screenshots in `screenshots/` and simple diagrams to explain the flow. Keep slide text concise. Clearly distinguish what works today from what is simplified and what comes next. The screenshots show real sessions held by the test harness; the user, Alex, is scripted.

## Slide 1 — Warmup: Practice the Conversations You'd Rather Avoid

Talk out loud with AI people who react like real ones.
- Ask a good question and they warm up.
- Give one-word answers and they drift away.
- Afterwards, replay it and try the hard moment again.

Built on AssemblyAI: Voice Agent API (with the new Universal-3.6 Pro Realtime), Universal-3.5 Pro and LLM Gateway.
Try it: warmup-assembly.vercel.app
By Christopher Pietsch and Franz Anhäupl.

Visual: `screenshots/home.png`, the headline beside the demo card where Jess cools at "Cool." and warms up at a real follow-up.

## Slide 2 — The Problem: You Can't Rehearse a Conversation Alone

Small talk, networking, a first date, being put on the spot.
- Getting better takes practice, and practicing with a real person is the part that feels hard.
- Tips don't help in the moment. You have to say the words and hear how they land.
- AI chat partners stay endlessly patient, so a one-word answer costs you nothing.

The challenge: How can people practice a hard conversation somewhere it's safe to get it wrong?
Target users: Anyone who dreads these moments, from people with social anxiety to job seekers, new hires and people dating again.

Visual: A speech bubble saying "Cool." while the gauge around a portrait drops from amber to cool blue.

## Slide 3 — The Idea: A Practice Partner Who Reacts Like a Person

Exposure practice, one rung at a time.
1. Pick a scene on the ladder, from ordering a coffee to asking someone out.
2. Talk out loud. Nothing to hold or press: speak, and pause when you're done.
3. They react. Their interest rises and falls with what you say, and their mood follows.
4. Get a replay: what worked, what to try, how you sounded.
5. Try the hard moment again.

Visual: `screenshots/ladder.png` (seven scenes on five pastel steps), with a loop beside it: Talk, They react, Replay, Try again. `screenshots/briefing.png` shows what you see before you start: the setting, your goals, tips, and who speaks first.

## Slide 4 — In the Conversation: They Feel It Too

- A gauge around their portrait moves after every turn and says why: +8 Followed up on "climbing", −7 Very short answer.
- Their mood follows. When their interest crosses a band, the app changes their mood mid-conversation, so they open up, or look for an exit and leave.
- Captions follow their voice word by word. Goals tick off as you reach them, and optional hints suggest what to say next.
- Hands-free, even on a phone speaker.

Visual: `screenshots/live-room.png` on a laptop (Jess in front of the blurred café) and `screenshots/live-phone.png` on a phone beside it.

## Slide 5 — The Interest Engine: How a Turn Moves Them

Every turn runs the same loop:
Your turn → signals → interest (0 to 100) → mood → session.update → their next reply

- Signals are transparent rules: questions, follow-ups on what they said, sharing, answer length, response time, talking over them. Every change can be explained.
- Five moods, from "checking out" to "enjoying it". Crossing into a new one rewrites the persona's instructions mid-session.
- The persona is a full LLM, so it reacts to meaning too.
- Let their interest drop too far and they excuse themselves and leave.

What we learned: session.update takes effect on the very next reply, so the persona's mood can change without restarting the conversation.

Visual: The loop as a diagram, with the five moods on the interest gradient.

## Slide 6 — The Replay: What Worked, What to Try Next

Measured from the recording, not guessed.
- A one-line verdict and the goals you reached.
- The interest curve: click any turn or pinned moment to hear it.
- Coach notes: one thing to work on next time, and a line you could have said instead.
- How you sounded: response time, share of the talking, questions, filler words, pace and pauses, from word timings.

Visual: `screenshots/report.png`, with `screenshots/replay.png` (a turn playing, its dot highlighted on the curve) and `screenshots/coach.png`. `screenshots/metrics.png` if there's room.

## Slide 7 — Try This Moment Again

The second go real life never gives you.
- Pick a moment the coach flagged.
- The persona says the exact same line again, remembering everything before it.
- Answer differently, hear their reaction, and compare the two attempts.

Visual: `screenshots/moments.png` (the flagged moments, each with "Try this moment again") leading to `screenshots/retake.png`.

## Slide 8 — Behind the Scenes: How Warmup Uses AssemblyAI

Architecture:
During the conversation: Browser ↔ Voice Agent API
Afterwards: Sessions API → Universal-3.5 Pro → LLM Gateway

- Voice Agent API: one live session per conversation, hearing you with the new Universal-3.6 Pro Realtime. session.update changes the persona's mood, reply.create makes them leave, and word timings sync the captions.
- Sessions API: the two-channel recording, you on the left and the persona on the right, ready as soon as the session ends.
- Universal-3.5 Pro: transcribes it with multichannel and disfluencies, so every um and every pause is measured.
- LLM Gateway: writes the coach notes from the transcript and metrics.

The API key stays on the server, which hands the browser single-use tokens. There is no database: your history stays in your browser.

Visual: Two lanes. On top, the live loop between the browser (mic, voice, interest engine) and the Voice Agent API. Below, the path after the session: recording, transcript and metrics, coach notes.

## Slide 9 — What We Learned: Measured, Not Guessed

- 1.5 to 2 s, usually, from the end of your sentence to the persona's first audio.
- 8 to 16 s to transcribe a minute of two-channel audio.
- 9 → 0 times the persona cut itself off on a simulated phone speaker, once an echo guard mutes the mic when its voice leaks in. With the voice played as call audio through an in-page WebRTC connection, it works on a real phone.
- 130 → 0 glitches at chunk joins in one reply, after streaming the voice's 10 ms chunks through one AudioWorklet instead of playing each on its own.

How we measured: the app is tested against the real APIs with no one talking. A throwaway session's greeting, spoken word for word, voices the "user", and a fake microphone in headless Chrome speaks it whenever the app says "Your turn".

Everything we found: docs/findings.md

Visual: Four number cards, then a small loop for the test: script, greeting as voice, fake microphone, Warmup, report checks.

## Slide 10 — Where It Stands

Working today:
- Seven scenes with a live interest gauge, mood changes, captions, goals and hints.
- The replay: recording, metrics, coach notes, moments and retakes.
- Desktop and phone, including a phone speaker.

Simplified for the hackathon:
- Scenes and personas are hand-written, and the interest gauge is rule-based.
- Coach notes come from the one small model a free account can use, at 2 requests a minute. Quick rule-based notes fill in while it's busy.
- History stays in one browser, with no accounts. English only.

Next:
- Choose a focus audience and write scenes for it.
- Progress across sessions.
- Your own scene: describe the conversation you're dreading and practice that one.

Try it: warmup-assembly.vercel.app
Code: github.com/cpietsch/warmup
Small print: Emoji by OpenMoji, CC BY-SA 4.0.

Visual: Three columns, clearly labeled Working, Simplified and Next, with the orb glowing amber above the link and a QR code to the app.
