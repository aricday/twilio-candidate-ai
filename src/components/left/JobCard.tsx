import { Building2, Check, Clock, MapPin, X } from 'lucide-react';
import { CRITERIA, type AtsRecord, type Criterion, type GateResult, type Job } from '../../../shared/types';

interface Props {
  job: Job;
  gates: Record<Criterion, GateResult>;
  outcome?: AtsRecord['outcome'];
}

const badgeStyles = {
  pending: 'border-slate-200 bg-slate-50 text-slate-500',
  passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
} as const;

const BadgeIcon = { pending: Clock, passed: Check, failed: X } as const;

export function JobCard({ job, gates, outcome }: Props) {
  return (
    <section className="mx-6 mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Building2 className="size-3.5" /> {job.company}
          </div>
          <div className="mt-0.5 text-lg font-semibold">{job.role}</div>
          <div className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="size-3.5" /> {job.location} • {job.pay}
          </div>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">{job.id}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {CRITERIA.map((c) => {
          const gate = gates[c];
          const Icon = BadgeIcon[gate.status];
          return (
            <div
              key={c}
              title={gate.note}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${badgeStyles[gate.status]}`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="font-medium">{job.gates[c].label}</span>
              <span className="ml-auto text-xs capitalize opacity-75">{gate.status}</span>
            </div>
          );
        })}
      </div>

      {outcome && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            outcome.overallQualified ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {outcome.overallQualified
            ? 'Qualified — fast-tracked for an on-site hiring manager interview'
            : 'Not qualified for this role — profile kept active for general warehouse openings'}
        </div>
      )}
    </section>
  );
}
