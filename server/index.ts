import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config, requireEnv } from './config';
import { handleRelayConnection } from './relay/session';
import { atsRouter } from './routes/ats';
import { tokenRouter } from './routes/token';
import { voiceRouter } from './routes/voice';
import { validateRelayHandshake } from './twilioAuth';
import { attachUiSocket, isValidUiSessionId } from './ui/hub';

requireEnv(
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY',
  'TWILIO_API_SECRET',
  'TWILIO_TWIML_APP_SID',
  'OPENAI_API_KEY',
  'PUBLIC_BASE_URL',
);

const app = express();
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(tokenRouter);
app.use(voiceRouter);
app.use(atsRouter);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// In production mode, serve the built client so a single ngrok tunnel covers everything.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = createServer(app);
const relayWss = new WebSocketServer({ noServer: true });
const uiWss = new WebSocketServer({ noServer: true });

relayWss.on('connection', handleRelayConnection);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/ws/conversation') {
    if (!validateRelayHandshake(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    relayWss.handleUpgrade(req, socket, head, (ws) => relayWss.emit('connection', ws, req));
    return;
  }

  if (url.pathname === '/ws/ui') {
    const session = url.searchParams.get('session');
    if (!isValidUiSessionId(session)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    uiWss.handleUpgrade(req, socket, head, (ws) => attachUiSocket(ws, session));
    return;
  }

  socket.destroy();
});

server.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
  console.log(`[server] Twilio reaches us at ${config.publicBaseUrl || '(PUBLIC_BASE_URL not set)'}`);
  console.log(
    `[server] model=${config.openai.model} speechTimeout=${config.relay.speechTimeoutMs}ms ` +
      `eotThreshold=${config.relay.eotThreshold} ignoreBackchannel=${config.relay.ignoreBackchannel} ` +
      `echoPromptFiltering=${config.relay.echoPromptFiltering}`,
  );
});
