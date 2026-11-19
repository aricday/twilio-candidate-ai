// POST /api/voice — the TwiML App's Voice URL. Connects the browser call to ConversationRelay (PRD §6.3).
import { Router } from 'express';
import twilio from 'twilio';
import { buildWelcomeGreeting } from '../ai/systemPrompt';
import { getCandidate, JOB } from '../ats/store';
import { config } from '../config';
import { validateTwilioWebhook, wssBase } from '../twilioAuth';
import { emit, isValidUiSessionId } from '../ui/hub';

const { VoiceResponse } = twilio.twiml;

export const voiceRouter = Router();

/** The latency-tuned <ConversationRelay> attributes (DECISIONS.md, Decisions 5–8). */
export function relayAttributes(wsUrl: string, welcomeGreeting: string) {
  const { relay } = config;
  return {
    url: wsUrl,
    welcomeGreeting,
    language: 'en-US',
    transcriptionProvider: 'Deepgram',
    speechModel: 'flux',
    partialPrompts: true,
    includeInPrompt: 'turn-state',
    speechTimeout: String(relay.speechTimeoutMs),
    eotThreshold: String(relay.eotThreshold),
    ignoreBackchannel: relay.ignoreBackchannel,
    echoPromptFiltering: relay.echoPromptFiltering,
    interruptible: 'any',
    dtmfDetection: true,
    ...(relay.ttsProvider && { ttsProvider: relay.ttsProvider }),
    ...(relay.voice && { voice: relay.voice }),
  };
}

voiceRouter.post('/api/voice', validateTwilioWebhook, (req, res) => {
  const candidate = getCandidate(req.body.candidateId);
  const jobId = JOB.id;
  const uiSessionId = isValidUiSessionId(req.body.uiSessionId) ? req.body.uiSessionId : '';

  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  // The SDK's attribute typings lag the docs (e.g. lowercase `speechtimeout`, no `eotThreshold`), and
  // TwiML attribute names are case-sensitive, so pass the documented names directly.
  const relay = connect.conversationRelay(
    relayAttributes(`${wssBase(req)}/ws/conversation`, buildWelcomeGreeting(candidate)) as never,
  );
  relay.parameter({ name: 'candidateId', value: candidate.id });
  relay.parameter({ name: 'jobId', value: jobId });
  relay.parameter({ name: 'uiSessionId', value: uiSessionId });

  emit(uiSessionId, {
    type: 'hop',
    step: 1,
    edges: ['browser-voice', 'voice-backend'],
    label: 'TwiML webhook → <Connect><ConversationRelay>',
    detail: `CallSid ${req.body.CallSid ?? '—'} • speechModel: flux`,
    ts: Date.now(),
  });

  res.type('text/xml').send(twiml.toString());
});
