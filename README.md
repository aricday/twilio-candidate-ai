# Hiring AI — Voice Candidate Screening Demo

A split-screen demo of **Twilio ConversationRelay** and the **Twilio Voice JavaScript SDK**. On the left, a candidate talks to "Candidate AI" from the browser to screen for an Owl Warehouse job. On the right, an "Under the hood" view shows each hop live: the architecture diagram, event telemetry with latency timings, and the code behind each step.

## How it works

```text
Browser (Voice SDK) ──WebRTC──▶ Twilio Voice ──TwiML webhook──▶ Express  POST /api/voice
                                     │                               │
                            <Connect><ConversationRelay>             │
                                     ▼                               ▼
                         ConversationRelay ◀──WebSocket──▶ /ws/conversation ──▶ OpenAI gpt-5.4-nano
                         (Flux STT, TTS, barge-in)                   │
                                                                     └──tools──▶ stub ATS
Browser ◀──────────── /ws/ui (live transcript, checklist, diagram hops) ──────────── Express
```

| Path | Purpose |
| ---- | ------- |
| `src/` | React client (Vite, Tailwind). `hooks/useScreeningCall.ts` is the Voice SDK integration. |
| `server/routes/token.ts` | `GET /api/token`: Access Token with a VoiceGrant |
| `server/routes/voice.ts` | `POST /api/voice`: TwiML with the latency-tuned `<ConversationRelay>` |
| `server/relay/session.ts` | ConversationRelay WebSocket: turns, tool loop, barge-in, 5-minute cap |
| `server/ai/` | System prompt, tool schemas, OpenAI streaming |
| `server/ats/store.ts` | In-memory job and candidate stub data |
| `scripts/setup-twilio.ts` | Creates the TwiML App (and an API Key if needed) |

## Prerequisites

- Node 20+ and [ngrok](https://ngrok.com/) (`brew install ngrok`)
- A Twilio account that has accepted the **Predictive and Generative AI/ML Features Addendum** (Console → Voice → Settings → Privacy & Security). ConversationRelay won't connect without it.
- An OpenAI API key with access to `gpt-5.4-nano`

## Setup

```bash
npm install
cp .env.example .env
```

In `.env`, fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `OPENAI_API_KEY`. If you already have a Twilio API Key, add `TWILIO_API_KEY` and `TWILIO_API_SECRET`; otherwise the setup script creates one.

Then, in one terminal:

```bash
npm run tunnel            # ngrok http 3001 (on PUBLIC_BASE_URL's domain, if set)
```

And in another:

```bash
npm run setup:twilio      # detects the ngrok URL, creates the TwiML App, writes .env
npm run dev               # server on :3001, client on :5173
```

Open **<http://localhost:5173>** in Chrome or Edge, pick a candidate, and click **Start Screening Call**.

> The browser uses `localhost` (a secure context, so the microphone works). Only Twilio uses the ngrok URL.

### ngrok domain

If `PUBLIC_BASE_URL` is set to a reserved or custom ngrok domain (for example `https://aday.ngrok.io`), `npm run tunnel` starts ngrok on that domain. The URL never changes, so you only need to run `npm run setup:twilio` once.

If `PUBLIC_BASE_URL` is blank, ngrok picks a random URL on every restart. After each restart, run `npm run setup:twilio` again (it updates the TwiML App and `PUBLIC_BASE_URL`) and restart `npm run dev`.

## Tuning for latency

ConversationRelay settings can be overridden in `.env` without code changes (DECISIONS.md, Decisions 5–8):

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `CR_SPEECH_TIMEOUT_MS` | `900` | Maximum silence before Flux ends the turn (600–5000) |
| `CR_EOT_THRESHOLD` | `0.7` | End-of-turn confidence (0.5–0.9). Lower is faster but may cut in on pauses. |
| `CR_IGNORE_BACKCHANNEL` | `true` | "uh-huh" / "okay" don't interrupt the agent |
| `CR_ECHO_PROMPT_FILTERING` | `true` | The agent's own audio from speakers doesn't interrupt it |
| `CR_TTS_PROVIDER` / `CR_VOICE` | blank | Blank uses the ConversationRelay default (ElevenLabs Flash) |

The telemetry footer shows **First token from gpt-5.4-nano in N ms** for every turn. Use it to compare settings in rehearsal.

## Demo tips

- **Prompt chips:** during a call, clicking a "Try" chip sends that text as if the candidate said it. This is useful in a noisy room.
- **Barge-in:** start talking while iCIMS AI is speaking. The agent stops, and the telemetry shows the `interrupt` frame with what you heard.
- **Diagram nodes:** clicking a node, or **See how it's built**, opens the code behind that hop.
- **Outcomes:** answer "no" to any requirement to see the general-pool outcome; answer "yes" to all four to see the fast-track.
- Each call starts with a fresh ATS record, so you can rerun the demo as often as you like.

## Scripts

| Command | |
| ------- | - |
| `npm run dev` | Server (tsx watch) and Vite client |
| `npm run tunnel` | ngrok to port 3001, on `PUBLIC_BASE_URL`'s domain if set |
| `npm run setup:twilio` | Create or update the TwiML App and API Key |
| `npm run typecheck` | Type-check client and server |
| `npm run build` / `npm start` | Production build, served by Express on `:3001` |
