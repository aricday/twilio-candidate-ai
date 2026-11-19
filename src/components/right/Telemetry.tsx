import type { HopEvent } from '../../state';

export function Telemetry({ hops }: { hops: HopEvent[] }) {
  const recent = hops.slice(-8).reverse();
  const [latest, ...older] = recent;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 font-mono text-xs">
      {latest ? (
        <div className="text-slate-100">
          <span className="font-semibold text-accent">Now:</span> {latest.label}
          {latest.ms !== undefined && <span className="text-amber-300"> in {latest.ms}ms</span>}
          {latest.detail && <span className="text-slate-400"> • {latest.detail}</span>}
        </div>
      ) : (
        <div className="text-slate-500">Waiting for a call… events and hop timings appear here.</div>
      )}
      <div className="mt-2 space-y-1">
        {older.map((h) => (
          <div key={h.id} className="truncate text-slate-500">
            <span className="text-slate-600">{new Date(h.ts).toLocaleTimeString([], { hour12: false })}</span> {h.label}
            {h.ms !== undefined && <span className="text-amber-300/60"> {h.ms}ms</span>}
            {h.detail && <span> • {h.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
