import { Grid3x3, Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_CALL_MS, type CallStatus } from '../../hooks/useScreeningCall';

interface Props {
  status: CallStatus;
  muted: boolean;
  startedAt: number | null;
  error: string | null;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onDigit: (digit: string) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function CallControls({ status, muted, startedAt, error, onStart, onEnd, onToggleMute, onDigit }: Props) {
  const [now, setNow] = useState(Date.now());
  const [keypadOpen, setKeypadOpen] = useState(false);
  const inCall = status === 'in-call';

  useEffect(() => {
    if (!inCall) {
      setKeypadOpen(false);
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [inCall]);

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-white ${
            inCall ? 'pulse-ring bg-emerald-500' : 'bg-brand'
          }`}
        >
          <Phone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{inCall ? 'On a call with Candidate AI' : 'Talk to Candidate AI'}</div>
          <div className="text-sm text-slate-500">
            {inCall && startedAt
              ? `${formatClock(now - startedAt)} elapsed • ends automatically at ${formatClock(MAX_CALL_MS)}`
              : 'A real call from your browser. Your browser asks for the microphone; calls end on their own after 5 minutes.'}
          </div>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {inCall ? (
        <>
          {keypadOpen && (
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => onDigit(k)}
                  className="rounded-lg border border-slate-200 py-2 font-mono text-sm hover:bg-slate-50"
                >
                  {k}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={onToggleMute}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium ${
                muted ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />} {muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => setKeypadOpen((o) => !o)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium hover:bg-slate-50"
            >
              <Grid3x3 className="size-4" /> Keypad
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-medium text-white hover:bg-rose-700"
            >
              <PhoneOff className="size-4" /> End Call
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={onStart}
          disabled={status === 'connecting'}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white shadow hover:brightness-110 disabled:opacity-70"
        >
          {status === 'connecting' ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <Phone className="size-4" /> {status === 'ended' ? 'Start Another Screening Call' : 'Start Screening Call'}
            </>
          )}
        </button>
      )}
    </footer>
  );
}
