// Types shared by the Express server and the React client.

export type Criterion = 'over_18' | 'lift_50_lbs' | 'climb_ladder' | 'drive_forklift';
export const CRITERIA: Criterion[] = ['over_18', 'lift_50_lbs', 'climb_ladder', 'drive_forklift'];

export type GateStatus = 'pending' | 'passed' | 'failed';
export type NextStep = 'FAST_TRACK_INTERVIEW' | 'ROUTE_TO_GENERAL_POOL';

export interface Job {
  id: string;
  company: string;
  role: string;
  location: string;
  pay: string;
  shifts: string[];
  duties: string[];
  gates: Record<Criterion, { label: string; requirement: string }>;
}

export interface Candidate {
  id: string;
  name: string;
  firstName: string;
  status: 'New Applicant' | 'Returning Applicant';
  email: string;
  history?: string;
}

export interface GateResult {
  status: GateStatus;
  note?: string;
  at?: string;
}

export interface AtsRecord {
  candidateId: string;
  jobId: string;
  gates: Record<Criterion, GateResult>;
  outcome?: {
    overallQualified: boolean;
    recommendedNextStep: NextStep;
    at: string;
  };
  updatedAt: string;
}

/** Architecture diagram nodes and the hops between them. */
export type NodeId = 'browser' | 'voice' | 'relay' | 'backend' | 'openai' | 'ats';
export type EdgeId =
  | 'browser-backend' // token fetch + UI event socket
  | 'browser-voice' // WebRTC audio
  | 'voice-backend' // TwiML webhook
  | 'voice-relay' // <Connect><ConversationRelay>
  | 'relay-backend' // ConversationRelay WebSocket
  | 'backend-openai' // streaming completion
  | 'backend-ats'; // tool calls

export type Step = 1 | 2 | 3;

/** Events pushed from the server to the browser over /ws/ui. */
export type UiEvent =
  | {
      type: 'hop';
      step: Step;
      edges: EdgeId[];
      label: string;
      detail?: string;
      /** Measured latency for this hop, when there is one. */
      ms?: number;
      /** First hop of a new candidate turn — the diagram resets its "last turn" trail. */
      turnStart?: boolean;
      ts: number;
    }
  | { type: 'transcript'; id: string; role: 'user' | 'ai'; text: string; final: boolean; interrupted?: boolean }
  | { type: 'listening'; active: boolean }
  | { type: 'qualification'; criterion: Criterion; passed: boolean; note: string }
  | { type: 'screening-complete'; record: AtsRecord }
  | { type: 'call-ended'; reason: string };

/** Messages the browser can send to the server over /ws/ui. */
export type UiCommand = { type: 'inject'; text: string };
