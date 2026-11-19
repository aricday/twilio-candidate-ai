// In-memory stub of the iCIMS Applicant Tracking System and job catalog (PRD §4).
import { CRITERIA, type AtsRecord, type Candidate, type Criterion, type Job, type NextStep } from '../../shared/types';

export const JOB: Job = {
  id: 'OWL-2026-WH',
  company: 'Owl Warehouse',
  role: 'Warehouse Associate (Full-Time)',
  location: 'Logistics Hub North',
  pay: '$21.50/hr',
  shifts: ['Day Shift (6:00 AM – 2:30 PM)', 'Swing Shift (2:00 PM – 10:30 PM)'],
  duties: [
    'Picking and packing orders',
    'Operating material handling equipment',
    'Inventory cycle counts',
    'Loading freight',
  ],
  gates: {
    over_18: { label: '18+ Years Old', requirement: 'Must be at least 18 years old.' },
    lift_50_lbs: { label: 'Lift 50+ lbs', requirement: 'Must be able to safely and repeatedly lift over 50 pounds.' },
    climb_ladder: { label: 'Climb Ladders', requirement: 'Must be comfortable climbing ladders up to 15 feet.' },
    drive_forklift: {
      label: 'Forklift Certified',
      requirement: 'Must be certified or experienced in driving a sit-down or stand-up forklift.',
    },
  },
};

export const CANDIDATES: Candidate[] = [
  {
    id: 'candidate_jordan',
    name: 'Jordan Taylor',
    firstName: 'Jordan',
    status: 'New Applicant',
    email: 'jordan.taylor@example.com',
  },
  {
    id: 'candidate_casey',
    name: 'Casey Morgan',
    firstName: 'Casey',
    status: 'Returning Applicant',
    email: 'casey.morgan@example.com',
    history: 'Worked a seasonal picker contract at Owl Warehouse in 2025 and is eligible for rehire.',
  },
];

const records = new Map<string, AtsRecord>();

export function getCandidate(id: string | undefined): Candidate {
  return CANDIDATES.find((c) => c.id === id) ?? CANDIDATES[0];
}

function blankRecord(candidateId: string): AtsRecord {
  return {
    candidateId,
    jobId: JOB.id,
    gates: Object.fromEntries(CRITERIA.map((c) => [c, { status: 'pending' }])) as AtsRecord['gates'],
    updatedAt: new Date().toISOString(),
  };
}

export function getRecord(candidateId: string): AtsRecord {
  let record = records.get(candidateId);
  if (!record) {
    record = blankRecord(candidateId);
    records.set(candidateId, record);
  }
  return record;
}

/** Each screening call starts from a clean record so the demo can be re-run. */
export function resetRecord(candidateId: string): AtsRecord {
  const record = blankRecord(candidateId);
  records.set(candidateId, record);
  return record;
}

export function recordGate(candidateId: string, criterion: Criterion, passed: boolean, note: string): AtsRecord {
  const record = getRecord(candidateId);
  const at = new Date().toISOString();
  record.gates[criterion] = { status: passed ? 'passed' : 'failed', note, at };
  record.updatedAt = at;
  return record;
}

export function pendingGates(candidateId: string): Criterion[] {
  const record = getRecord(candidateId);
  return CRITERIA.filter((c) => record.gates[c].status === 'pending');
}

export function finalize(candidateId: string): AtsRecord {
  const record = getRecord(candidateId);
  // The server decides the outcome from recorded gates rather than trusting the model's claim.
  const overallQualified = CRITERIA.every((c) => record.gates[c].status === 'passed');
  const recommendedNextStep: NextStep = overallQualified ? 'FAST_TRACK_INTERVIEW' : 'ROUTE_TO_GENERAL_POOL';
  const at = new Date().toISOString();
  record.outcome = { overallQualified, recommendedNextStep, at };
  record.updatedAt = at;
  return record;
}
