import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Candidate, Job, NodeId, Step, UiEvent } from '../shared/types';
import { CallControls } from './components/left/CallControls';
import { CandidateHeader } from './components/left/CandidateHeader';
import { JobCard } from './components/left/JobCard';
import { Transcript } from './components/left/Transcript';
import { CodeDrawer } from './components/right/CodeDrawer';
import { Diagram } from './components/right/Diagram';
import { Stepper } from './components/right/Stepper';
import { Telemetry } from './components/right/Telemetry';
import { NODE_SNIPPET, SNIPPETS } from './data/snippets';
import { useScreeningCall } from './hooks/useScreeningCall';
import { useUiEvents } from './hooks/useUiEvents';
import { initialState, reducer } from './state';

const SETTLE_MS = 1800;

export function App() {
  const uiSessionId = useMemo(() => crypto.randomUUID().replaceAll('-', ''), []);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState('candidate_jordan');
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [drawer, setDrawer] = useState<{ open: boolean; snippetId: string }>({ open: false, snippetId: SNIPPETS[0].id });

  useEffect(() => {
    fetch('/api/job').then((r) => r.json()).then(setJob);
    fetch('/api/candidates').then((r) => r.json()).then(setCandidates);
  }, []);

  const onEvent = useCallback((event: UiEvent) => dispatch({ type: 'event', event }), []);
  const sendCommand = useUiEvents(uiSessionId, onEvent);

  const onLocalHop = useCallback(
    (label: string, detail: string) =>
      onEvent({ type: 'hop', step: 1, edges: ['browser-voice'], label, detail, turnStart: true, ts: Date.now() }),
    [onEvent],
  );

  const call = useScreeningCall({ uiSessionId, jobId: job?.id ?? 'OWL-2026-WH', onLocalHop });
  const inCall = call.status === 'in-call';
  const busy = inCall || call.status === 'connecting';

  // Let the "now" highlight fade into the "last turn" trail.
  useEffect(() => {
    if (!state.nowEdges.length) return;
    const t = setTimeout(() => dispatch({ type: 'settle' }), SETTLE_MS);
    return () => clearTimeout(t);
  }, [state.nowEdges, state.hops.length]);

  const startCall = () => {
    dispatch({ type: 'reset' });
    setSelectedStep(null);
    call.start(candidateId);
  };

  const changeCandidate = (id: string) => {
    setCandidateId(id);
    dispatch({ type: 'reset' });
  };

  const openSnippet = (snippetId: string) => setDrawer({ open: true, snippetId });
  const candidate = candidates.find((c) => c.id === candidateId);

  return (
    <div className="grid h-full grid-cols-2">
      {/* Left: candidate experience */}
      <main className="flex min-h-0 flex-col bg-slate-50">
        <CandidateHeader candidates={candidates} candidateId={candidateId} onChange={changeCandidate} disabled={busy} />
        {job && <JobCard job={job} gates={state.gates} outcome={state.outcome} />}
        <Transcript
          entries={state.transcript}
          listening={state.listening}
          inCall={inCall}
          candidateName={candidate?.firstName ?? 'You'}
          onPrompt={(text) => sendCommand({ type: 'inject', text })}
        />
        <CallControls
          status={call.status}
          muted={call.muted}
          startedAt={call.startedAt}
          error={call.error}
          onStart={startCall}
          onEnd={call.end}
          onToggleMute={call.toggleMute}
          onDigit={call.sendDigit}
        />
      </main>

      {/* Right: developer experience */}
      <section className="flex min-h-0 flex-col gap-4 bg-slate-950 p-6 text-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Under the hood</h1>
            <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded bg-accent" /> now
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded bg-slate-500" /> last turn
              </span>
            </div>
          </div>
          <button
            onClick={() => openSnippet(drawer.snippetId)}
            className="flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white"
          >
            See how it's built <ArrowRight className="size-4" />
          </button>
        </div>

        <Stepper live={state.step} selected={selectedStep ?? state.step} onSelect={setSelectedStep} />

        <div className="min-h-0 flex-1">
          <Diagram
            nowEdges={state.nowEdges}
            turnEdges={state.turnEdges}
            onNodeClick={(id: NodeId) => openSnippet(NODE_SNIPPET[id])}
          />
        </div>

        <Telemetry hops={state.hops} />
      </section>

      <CodeDrawer
        open={drawer.open}
        snippetId={drawer.snippetId}
        onSelect={(snippetId) => setDrawer({ open: true, snippetId })}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}
