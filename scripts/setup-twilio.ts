// One-time (and per-ngrok-URL) Twilio setup:
//   1. Detects the public URL (PUBLIC_BASE_URL, or the running ngrok tunnel).
//   2. Creates an API Key/Secret for Access Tokens if TWILIO_API_KEY isn't set.
//   3. Creates the TwiML App (or updates its Voice URL if TWILIO_TWIML_APP_SID is set).
//   4. Writes the resulting values back into .env.
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import twilio from 'twilio';

const ENV_FILE = '.env';

async function detectNgrokUrl(): Promise<string | undefined> {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    const { tunnels } = (await res.json()) as { tunnels: { public_url: string }[] };
    return tunnels.find((t) => t.public_url.startsWith('https://'))?.public_url;
  } catch {
    return undefined;
  }
}

function writeEnv(updates: Record<string, string>): void {
  let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  writeFileSync(ENV_FILE, text);
}

async function main(): Promise<void> {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = process.env;
  if (!accountSid || !authToken) {
    throw new Error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env first (copy .env.example).');
  }
  const client = twilio(accountSid, authToken);
  const updates: Record<string, string> = {};

  const ngrokUrl = await detectNgrokUrl();
  const baseUrl = (ngrokUrl ?? process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('No public URL. Start ngrok (npm run tunnel) or set PUBLIC_BASE_URL in .env.');
  if (baseUrl !== process.env.PUBLIC_BASE_URL) updates.PUBLIC_BASE_URL = baseUrl;
  console.log(`Public URL: ${baseUrl}${ngrokUrl ? ' (detected from ngrok)' : ''}`);

  if (!process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
    const key = await client.newKeys.create({ friendlyName: 'iCIMS AI Voice Demo' });
    updates.TWILIO_API_KEY = key.sid;
    updates.TWILIO_API_SECRET = key.secret;
    console.log(`Created API Key ${key.sid}`);
  }

  const voiceUrl = `${baseUrl}/api/voice`;
  const existingSid = process.env.TWILIO_TWIML_APP_SID;
  if (existingSid) {
    await client.applications(existingSid).update({ voiceUrl, voiceMethod: 'POST' });
    console.log(`Updated TwiML App ${existingSid} → ${voiceUrl}`);
  } else {
    const app = await client.applications.create({
      friendlyName: 'iCIMS AI Voice Demo',
      voiceUrl,
      voiceMethod: 'POST',
    });
    updates.TWILIO_TWIML_APP_SID = app.sid;
    console.log(`Created TwiML App ${app.sid} → ${voiceUrl}`);
  }

  if (Object.keys(updates).length) {
    writeEnv(updates);
    console.log(`Updated ${ENV_FILE}: ${Object.keys(updates).join(', ')}`);
  }
  console.log('Done. Restart `npm run dev` if it was already running.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
