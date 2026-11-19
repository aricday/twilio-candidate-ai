// Routes "under the hood" events to the browser that placed the call. Each browser tab picks a
// random UI session id, opens /ws/ui?session=<id>, and passes the same id through the call
// (Voice SDK params -> TwiML <Parameter> -> ConversationRelay setup message).
import type { WebSocket } from 'ws';
import type { UiCommand, UiEvent } from '../../shared/types';

const sockets = new Map<string, Set<WebSocket>>();
const injectors = new Map<string, (text: string) => void>();

const SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidUiSessionId(id: unknown): id is string {
  return typeof id === 'string' && SESSION_ID.test(id);
}

export function emit(uiSessionId: string | undefined, event: UiEvent): void {
  if (!uiSessionId) return;
  const payload = JSON.stringify(event);
  for (const ws of sockets.get(uiSessionId) ?? []) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

export function attachUiSocket(ws: WebSocket, uiSessionId: string): void {
  let set = sockets.get(uiSessionId);
  if (!set) sockets.set(uiSessionId, (set = new Set()));
  set.add(ws);

  ws.on('message', (raw) => {
    let cmd: UiCommand;
    try {
      cmd = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (cmd.type === 'inject' && typeof cmd.text === 'string' && cmd.text.trim()) {
      injectors.get(uiSessionId)?.(cmd.text.trim().slice(0, 300));
    }
  });

  ws.on('close', () => {
    set!.delete(ws);
    if (!set!.size) sockets.delete(uiSessionId);
  });
}

/** Lets a prompt chip clicked in the UI be handled as if the candidate had said it. */
export function registerInjector(uiSessionId: string, fn: (text: string) => void): () => void {
  injectors.set(uiSessionId, fn);
  return () => {
    if (injectors.get(uiSessionId) === fn) injectors.delete(uiSessionId);
  };
}
