import {
  CRITERIA,
  type AtsRecord,
  type Criterion,
  type EdgeId,
  type GateResult,
  type Step,
  type UiEvent,
} from '../shared/types';

export type HopEvent = Extract<UiEvent, { type: 'hop' }> & { id: number };

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'ai';
  text: string;
  final: boolean;
  interrupted?: boolean;
}

export interface DemoState {
  transcript: TranscriptEntry[];
  gates: Record<Criterion, GateResult>;
  outcome?: AtsRecord['outcome'];
  listening: boolean;
  hops: HopEvent[];
  step: Step;
  /** Edges in the most recent hop ("now"). */
  nowEdges: EdgeId[];
  /** Edges already traversed during the current candidate turn ("last turn"). */
  turnEdges: EdgeId[];
}

export type Action =
  | { type: 'event'; event: UiEvent }
  | { type: 'settle' }
  | { type: 'reset' };

const blankGates = () =>
  Object.fromEntries(CRITERIA.map((c) => [c, { status: 'pending' }])) as Record<Criterion, GateResult>;

export const initialState: DemoState = {
  transcript: [],
  gates: blankGates(),
  listening: false,
  hops: [],
  step: 1,
  nowEdges: [],
  turnEdges: [],
};

let hopSeq = 0;
const union = (a: EdgeId[], b: EdgeId[]) => [...new Set([...a, ...b])];

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'reset':
      return { ...initialState, gates: blankGates() };

    case 'settle':
      // The "now" highlight fades into the "last turn" trail.
      return { ...state, turnEdges: union(state.turnEdges, state.nowEdges), nowEdges: [] };

    case 'event':
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: DemoState, event: UiEvent): DemoState {
  switch (event.type) {
    case 'hop': {
      const previous = event.turnStart ? [] : union(state.turnEdges, state.nowEdges);
      return {
        ...state,
        hops: [...state.hops.slice(-79), { ...event, id: ++hopSeq }],
        // Phases only move forward within a call; 'reset' starts the next call back at step 1.
        step: Math.max(state.step, event.step) as Step,
        nowEdges: event.edges,
        turnEdges: previous,
      };
    }

    case 'transcript': {
      const index = state.transcript.findIndex((t) => t.id === event.id);
      const entry: TranscriptEntry = {
        id: event.id,
        role: event.role,
        text: event.text,
        final: event.final,
        interrupted: event.interrupted,
      };
      const transcript =
        index === -1
          ? [...state.transcript, entry]
          : state.transcript.map((t, i) => (i === index ? entry : t));
      return { ...state, transcript };
    }

    case 'listening':
      return { ...state, listening: event.active };

    case 'qualification':
      return {
        ...state,
        gates: {
          ...state.gates,
          [event.criterion]: { status: event.passed ? 'passed' : 'failed', note: event.note },
        },
      };

    case 'screening-complete':
      return { ...state, gates: event.record.gates, outcome: event.record.outcome };

    case 'call-ended':
      return { ...state, listening: false };
  }
}
