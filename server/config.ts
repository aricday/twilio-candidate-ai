import 'dotenv/config';

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v.toLowerCase() === 'true';
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  /** Public https URL Twilio uses to reach this server (the ngrok URL). */
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    apiKey: process.env.TWILIO_API_KEY ?? '',
    apiSecret: process.env.TWILIO_API_SECRET ?? '',
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID ?? '',
    validateSignatures: bool('TWILIO_VALIDATE_SIGNATURES', true),
  },

  openai: {
    model: process.env.OPENAI_MODEL ?? 'gpt-5.4-nano',
  },

  // Latency-tuned ConversationRelay settings (see DECISIONS.md, Decisions 5–8).
  relay: {
    speechTimeoutMs: Number(process.env.CR_SPEECH_TIMEOUT_MS ?? 900),
    eotThreshold: Number(process.env.CR_EOT_THRESHOLD ?? 0.7),
    ignoreBackchannel: bool('CR_IGNORE_BACKCHANNEL', true),
    echoPromptFiltering: bool('CR_ECHO_PROMPT_FILTERING', true),
    ttsProvider: process.env.CR_TTS_PROVIDER ?? '',
    voice: process.env.CR_VOICE ?? '',
  },

  maxCallMs: Number(process.env.MAX_CALL_SECONDS ?? 300) * 1000,
};

export function requireEnv(...names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.warn(`[config] Missing env vars: ${missing.join(', ')} — see .env.example`);
  }
}
