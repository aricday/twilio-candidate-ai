// Curated excerpts of the code that runs this demo, for the "See how it's built" drawer.
// Full sources live in src/hooks/useScreeningCall.ts and server/.
import type { NodeId } from '../../shared/types';

export interface Snippet {
  id: string;
  title: string;
  where: 'YOUR BROWSER' | 'TWILIO' | 'CUSTOMER BACKEND' | 'MODEL VENDOR' | 'iCIMS ATS';
  file: string;
  explanation: string;
  code: string;
}

export const SNIPPETS: Snippet[] = [
  {
    id: 'browser',
    title: 'Browser click-to-call',
    where: 'YOUR BROWSER',
    file: 'src/hooks/useScreeningCall.ts',
    explanation:
      'The Voice JavaScript SDK places a real WebRTC call from the browser. Custom params ride along with the call and arrive at the TwiML webhook, so the backend knows which candidate and job this is.',
    code: `import { Call, Device } from '@twilio/voice-sdk';

const res = await fetch(\`/api/token?identity=\${candidateId}\`);
const { token } = await res.json();

const device = new Device(token, {
  codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
  enableImprovedSignalingErrorPrecision: true,
});

const call = await device.connect({
  params: { candidateId, jobId: 'OWL-2026-WH', uiSessionId },
});

call.on('accept', () => console.log('Screening call connected'));
call.on('disconnect', () => device.destroy());`,
  },
  {
    id: 'token',
    title: 'Access Token',
    where: 'CUSTOMER BACKEND',
    file: 'server/routes/token.ts',
    explanation:
      'A short-lived JWT with a VoiceGrant lets the browser make outgoing calls through your TwiML App. It is signed with an API Key, so the Auth Token never leaves the server.',
    code: `const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

router.get('/api/token', (req, res) => {
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity: candidateId, ttl: 600 },
  );
  token.addGrant(voiceGrant);

  res.json({ token: token.toJwt() });
});`,
  },
  {
    id: 'twiml',
    title: '<Connect><ConversationRelay>',
    where: 'TWILIO',
    file: 'server/routes/voice.ts',
    explanation:
      'The TwiML App calls this webhook when the browser call starts. One TwiML noun hands the call to ConversationRelay, which handles speech-to-text, text-to-speech, turn detection and barge-in. These attributes are tuned for latency: Deepgram Flux decides when the candidate has finished speaking, partial prompts stream the transcript live, and a 900 ms silence cap keeps turns snappy.',
    code: `router.post('/api/voice', validateTwilioWebhook, (req, res) => {
  const twiml = new VoiceResponse();
  const relay = twiml.connect().conversationRelay({
    url: \`wss://\${host}/ws/conversation\`,
    welcomeGreeting: \`Hi \${candidate.firstName}! This is Candidate AI…\`,
    language: 'en-US',
    transcriptionProvider: 'Deepgram',
    speechModel: 'flux',             // built-in end-of-turn detection
    partialPrompts: true,            // live transcript while speaking
    includeInPrompt: 'turn-state',   // start | interim | end
    speechTimeout: '900',            // max silence before ending the turn
    eotThreshold: '0.7',             // end-of-turn confidence
    ignoreBackchannel: true,         // "uh-huh" doesn't interrupt
    echoPromptFiltering: true,       // agent's own echo doesn't interrupt
    interruptible: 'any',
    dtmfDetection: true,
  });
  relay.parameter({ name: 'candidateId', value: candidate.id });
  relay.parameter({ name: 'jobId', value: 'OWL-2026-WH' });

  res.type('text/xml').send(twiml.toString());
});`,
  },
  {
    id: 'relay',
    title: 'ConversationRelay WebSocket',
    where: 'CUSTOMER BACKEND',
    file: 'server/relay/session.ts',
    explanation:
      'ConversationRelay sends JSON text frames: setup, prompt, interrupt and dtmf. Partial prompts update the live transcript; only the final prompt (turnState "end") goes to the model. On barge-in the backend aborts the OpenAI stream and keeps only what the candidate actually heard in the conversation history.',
    code: `ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());

  switch (msg.type) {
    case 'setup':
      // customParameters come from the TwiML <Parameter> elements
      candidate = getCandidate(msg.customParameters.candidateId);
      messages = [
        { role: 'system', content: buildIcimsSystemPrompt(candidate) },
        { role: 'assistant', content: buildWelcomeGreeting(candidate) },
      ];
      break;

    case 'prompt':
      if (!msg.last) return showLiveTranscript(msg.voicePrompt); // start / interim
      runTurn(msg.voicePrompt);                                  // turnState: "end"
      break;

    case 'interrupt':
      // Stop generating and record only what the candidate heard
      abortTurn(currentTurn, msg.utteranceUntilInterrupt);
      break;
  }
});`,
  },
  {
    id: 'openai',
    title: 'Streaming + tool loop',
    where: 'MODEL VENDOR',
    file: 'server/ai/llm.ts • server/relay/session.ts',
    explanation:
      'gpt-5.4-nano with reasoning off streams tokens straight into ConversationRelay, so TTS starts speaking before the reply is finished. Tool calls are pieced together from the stream, run against the ATS, and their results go back to the model.',
    code: `const stream = await openai.chat.completions.create(
  { model: 'gpt-5.4-nano', messages, tools: icimsTools,
    stream: true, reasoning_effort: 'none' },
  { signal: abortController.signal },
);

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (delta?.content) {
    // Every token goes straight to TTS
    ws.send(JSON.stringify({ type: 'text', token: delta.content, last: false }));
  }
  for (const tc of delta?.tool_calls ?? []) accumulate(toolCalls, tc);
}

messages.push({ role: 'assistant', content, tool_calls: toolCalls });
for (const call of toolCalls) {
  const output = runTool(call.name, call.arguments);  // updates the stub ATS
  messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
}
// …then call the model again for the spoken reply, and finally:
ws.send(JSON.stringify({ type: 'text', token: '', last: true }));`,
  },
  {
    id: 'ats',
    title: 'Tool schema → iCIMS ATS',
    where: 'iCIMS ATS',
    file: 'server/ai/tools.ts',
    explanation:
      'Two function tools let the model write to the ATS. The server, not the model, works out the final outcome from the recorded gates. Each tool call also updates the checklist on the left in real time.',
    code: `{
  type: 'function',
  function: {
    name: 'record_qualification_response',
    description: "Records the candidate's answer to one of the four mandatory qualification questions.",
    parameters: {
      type: 'object',
      properties: {
        criterion: { type: 'string', enum: ['over_18', 'lift_50_lbs', 'climb_ladder', 'drive_forklift'] },
        passed: { type: 'boolean' },
        candidateNote: { type: 'string' },
      },
      required: ['criterion', 'passed', 'candidateNote'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'finalize_screening_status',
    description: 'Submits the final screening outcome to the iCIMS ATS.',
    parameters: {
      type: 'object',
      properties: {
        overallQualified: { type: 'boolean' },
        recommendedNextStep: { type: 'string', enum: ['FAST_TRACK_INTERVIEW', 'ROUTE_TO_GENERAL_POOL'] },
      },
      required: ['overallQualified', 'recommendedNextStep'],
    },
  },
}`,
  },
];

export const NODE_SNIPPET: Record<NodeId, string> = {
  browser: 'browser',
  voice: 'twiml',
  relay: 'twiml',
  backend: 'relay',
  openai: 'openai',
  ats: 'ats',
};
