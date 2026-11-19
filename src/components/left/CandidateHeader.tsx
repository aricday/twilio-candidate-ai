import { ChevronDown, Sparkles } from 'lucide-react';
import type { Candidate } from '../../../shared/types';

interface Props {
  candidates: Candidate[];
  candidateId: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

export function CandidateHeader({ candidates, candidateId, onChange, disabled }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-indigo-400 text-white shadow">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-base font-semibold leading-tight">Candidate AI</div>
          <div className="text-sm italic text-slate-500">Recruiting Assistant</div>
        </div>
      </div>

      <label className="relative">
        <span className="sr-only">Stub candidate profile</span>
        <select
          value={candidateId}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none rounded-full border border-slate-200 bg-brand-soft py-1.5 pl-4 pr-9 text-sm font-medium text-brand disabled:opacity-60"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} – {c.status}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand" />
      </label>
    </header>
  );
}
