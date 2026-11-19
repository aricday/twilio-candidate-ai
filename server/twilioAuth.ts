// X-Twilio-Signature validation for the TwiML webhook and the ConversationRelay WebSocket handshake.
import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import twilio from 'twilio';
import { config } from './config';

const enabled = () => config.twilio.validateSignatures && Boolean(config.twilio.authToken);

/** The public base URL Twilio used to reach us (ngrok), falling back to the forwarded Host header. */
export function publicBase(req: IncomingMessage): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  return `https://${host}`;
}

export function wssBase(req: IncomingMessage): string {
  return publicBase(req).replace(/^http/, 'ws');
}

export function validateTwilioWebhook(req: Request, res: Response, next: NextFunction): void {
  if (!enabled()) return next();
  const signature = req.header('x-twilio-signature') ?? '';
  const url = publicBase(req) + req.originalUrl;
  if (twilio.validateRequest(config.twilio.authToken, signature, url, req.body ?? {})) return next();
  console.warn(`[security] Rejected webhook with invalid X-Twilio-Signature for ${url}`);
  res.status(403).send('Invalid Twilio signature');
}

export function validateRelayHandshake(req: IncomingMessage): boolean {
  if (!enabled()) return true;
  const signature = String(req.headers['x-twilio-signature'] ?? '');
  const path = req.url ?? '';
  // Twilio signs the WebSocket URL from the TwiML; accept the wss:// form or its https:// equivalent.
  const candidates = [wssBase(req) + path, publicBase(req) + path];
  const ok = candidates.some((url) => twilio.validateRequest(config.twilio.authToken, signature, url, {}));
  if (!ok) console.warn(`[security] Rejected ConversationRelay handshake with invalid signature for ${path}`);
  return ok;
}
