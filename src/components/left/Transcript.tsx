import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../../state';

export const SUGGESTED_PROMPTS = [
  'Tell me about the Owl Warehouse job',
  'Start my qualification screening',
  'What are the physical requirements?',
];

interface Props {
  entries: TranscriptEntry[];
  listening: boolean;
  inCall: boolean;
  candidateName: string;
  onPrompt: (text: string) => void;
}

export function Transcript({ entries, listening, inCall, candidateName, onPrompt }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries, listening]);

  if (!entries.length && !inCall) {
    return (
      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Try</div>
        <div className="mt-2 flex flex-col items-start gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <span key={p} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
              “{p}”
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {inCall && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Try</span>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onPrompt(p)}
              title="Send as if spoken"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
        {entries.map((e) => (
          <div key={e.id} className={`flex flex-col ${e.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="mb-0.5 text-xs text-slate-400">{e.role === 'user' ? candidateName : 'Candidate AI'}</div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                e.role === 'user'
                  ? `rounded-br-sm bg-brand text-white ${e.final ? '' : 'opacity-70'}`
                  : 'rounded-bl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
              }`}
            >
              {e.text}
              {e.interrupted && <span className="ml-1 text-xs italic text-slate-400">(interrupted)</span>}
            </div>
          </div>
        ))}
        {listening && (
          <div className="flex justify-end">
            <div className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-brand"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
