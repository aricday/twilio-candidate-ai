import type { Step } from '../../../shared/types';

export const STEPS: { step: Step; title: string; description: string }[] = [
  {
    step: 1,
    title: 'Call connects',
    description:
      'The browser fetches an Access Token and places a WebRTC call. The TwiML App calls the backend webhook, which answers with <Connect><ConversationRelay> and opens the WebSocket.',
  },
  {
    step: 2,
    title: 'AI screens',
    description:
      'Every turn: Flux transcribes speech and detects the end of the turn, ConversationRelay sends the prompt over the WebSocket, gpt-5.4-nano streams tokens back to TTS, and tool calls update the stub ATS.',
  },
  {
    step: 3,
    title: 'ATS handoff',
    description:
      'Once all four gates are recorded, the final pass/fail outcome and next step are written to the candidate record in the mock iCIMS ATS.',
  },
];

interface Props {
  live: Step;
  selected: Step;
  onSelect: (step: Step) => void;
}

export function Stepper({ live, selected, onSelect }: Props) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((s) => {
          const isLive = s.step === live;
          const isSelected = s.step === selected;
          return (
            <button
              key={s.step}
              onClick={() => onSelect(s.step)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isSelected ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isLive ? 'pulse-ring bg-accent text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {s.step}
              </span>
              {s.title}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-400">{STEPS[selected - 1].description}</p>
    </div>
  );
}
