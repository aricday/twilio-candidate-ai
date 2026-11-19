import { Call, Device } from '@twilio/voice-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CallStatus = 'idle' | 'connecting' | 'in-call' | 'ended' | 'error';

export const MAX_CALL_MS = 5 * 60 * 1000;

interface Options {
  uiSessionId: string;
  jobId: string;
  /** Lets the browser report its own hops (the server can't see these). */
  onLocalHop: (label: string, detail: string) => void;
}

/** Browser click-to-call with the Twilio Voice JavaScript SDK (PRD §6.1). */
export function useScreeningCall({ uiSessionId, jobId, onLocalHop }: Options) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  const cleanup = useCallback((next: CallStatus) => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
    callRef.current = null;
    setMuted(false);
    setStartedAt(null);
    setStatus(next);
  }, []);

  const start = useCallback(
    async (candidateId: string) => {
      setStatus('connecting');
      setError(null);
      try {
        const res = await fetch(
          `/api/token?identity=${encodeURIComponent(candidateId)}&uiSession=${encodeURIComponent(uiSessionId)}`,
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not get an Access Token');

        const device = new Device(body.token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          enableImprovedSignalingErrorPrecision: true,
        });
        deviceRef.current = device;

        onLocalHop('WebRTC call placed (Voice SDK)', `device.connect({ params: { candidateId: '${candidateId}', jobId: '${jobId}' } })`);
        const call = await device.connect({ params: { candidateId, jobId, uiSessionId } });
        callRef.current = call;

        call.on('accept', () => {
          setStatus('in-call');
          setStartedAt(Date.now());
        });
        call.on('mute', (isMuted: boolean) => setMuted(isMuted));
        call.on('disconnect', () => cleanup('ended'));
        call.on('cancel', () => cleanup('ended'));
        call.on('error', (err: { message?: string }) => setError(err.message ?? 'Call error'));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        cleanup('error');
      }
    },
    [uiSessionId, jobId, onLocalHop, cleanup],
  );

  const end = useCallback(() => {
    if (callRef.current) callRef.current.disconnect();
    else cleanup('ended');
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    callRef.current?.mute(!callRef.current.isMuted());
  }, []);

  const sendDigit = useCallback((digit: string) => {
    callRef.current?.sendDigits(digit);
  }, []);

  // Backup for the server-side 5-minute limit.
  useEffect(() => {
    if (status !== 'in-call') return;
    const timer = setTimeout(end, MAX_CALL_MS + 5000);
    return () => clearTimeout(timer);
  }, [status, end]);

  useEffect(() => () => deviceRef.current?.destroy(), []);

  return { status, muted, startedAt, error, start, end, toggleMute, sendDigit };
}
