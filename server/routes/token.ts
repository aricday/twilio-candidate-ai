// GET /api/token — mints a Voice SDK Access Token (PRD §6.2).
import { Router } from 'express';
import twilio from 'twilio';
import { getCandidate } from '../ats/store';
import { config } from '../config';
import { emit, isValidUiSessionId } from '../ui/hub';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export const tokenRouter = Router();

tokenRouter.get('/api/token', (req, res) => {
  const { accountSid, apiKey, apiSecret, twimlAppSid } = config.twilio;
  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    res.status(500).json({ error: 'Twilio credentials or TWILIO_TWIML_APP_SID are not configured. Run npm run setup:twilio.' });
    return;
  }

  const identity = getCandidate(String(req.query.identity ?? '')).id;
  const uiSession = isValidUiSessionId(req.query.uiSession) ? req.query.uiSession : undefined;

  const voiceGrant = new VoiceGrant({ outgoingApplicationSid: twimlAppSid, incomingAllow: false });
  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity, ttl: 600 });
  token.addGrant(voiceGrant);

  emit(uiSession, {
    type: 'hop',
    step: 1,
    edges: ['browser-backend'],
    label: 'Access Token minted',
    detail: `identity: ${identity} • VoiceGrant → TwiML App`,
    ts: Date.now(),
  });

  res.json({ token: token.toJwt() });
});
