import { useCallback, useEffect, useRef } from 'react';
import type { UiCommand, UiEvent } from '../../shared/types';

/** Subscribes to this tab's "under the hood" event stream from the server (/ws/ui). */
export function useUiEvents(uiSessionId: string, onEvent: (event: UiEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/ui?session=${uiSessionId}`);
      wsRef.current = ws;
      ws.onmessage = (e) => onEventRef.current(JSON.parse(e.data));
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [uiSessionId]);

  return useCallback((cmd: UiCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(cmd));
  }, []);
}
