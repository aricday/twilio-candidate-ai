import type OpenAI from 'openai';
import { CRITERIA, type AtsRecord, type Criterion } from '../../shared/types';
import { finalize, JOB, pendingGates, recordGate } from '../ats/store';

export const icimsTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'record_qualification_response',
      description:
        "Records the candidate's answer to one of the four mandatory Owl Warehouse qualification questions. Call this immediately after the candidate answers each criterion.",
      parameters: {
        type: 'object',
        properties: {
          criterion: {
            type: 'string',
            enum: CRITERIA,
            description: 'The specific job qualification gate being evaluated.',
          },
          passed: {
            type: 'boolean',
            description: 'True if the candidate meets the requirement, false if they do not.',
          },
          candidateNote: {
            type: 'string',
            description: 'Brief 1-sentence summary of what the candidate said.',
          },
        },
        required: ['criterion', 'passed', 'candidateNote'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_screening_status',
      description:
        'Submits the final screening outcome to the iCIMS ATS once all four qualification criteria have been evaluated.',
      parameters: {
        type: 'object',
        properties: {
          overallQualified: {
            type: 'boolean',
            description: 'True only if all four criteria passed; otherwise false.',
          },
          recommendedNextStep: {
            type: 'string',
            enum: ['FAST_TRACK_INTERVIEW', 'ROUTE_TO_GENERAL_POOL'],
            description: 'Next workflow action in the iCIMS ATS.',
          },
        },
        required: ['overallQualified', 'recommendedNextStep'],
      },
    },
  },
];

export type ToolEffect =
  | { kind: 'qualification'; criterion: Criterion; passed: boolean; note: string }
  | { kind: 'finalized'; record: AtsRecord }
  | { kind: 'none' };

export interface ToolResult {
  /** JSON returned to the model as the tool message. */
  output: Record<string, unknown>;
  effect: ToolEffect;
}

/** Executes a tool call against the stub ATS. */
export function runTool(candidateId: string, name: string, rawArgs: string): ToolResult {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { output: { ok: false, error: 'Arguments were not valid JSON.' }, effect: { kind: 'none' } };
  }

  if (name === 'record_qualification_response') {
    const criterion = args.criterion as Criterion;
    if (!CRITERIA.includes(criterion)) {
      return { output: { ok: false, error: `Unknown criterion "${String(args.criterion)}".` }, effect: { kind: 'none' } };
    }
    const passed = Boolean(args.passed);
    const note = String(args.candidateNote ?? '');
    recordGate(candidateId, criterion, passed, note);
    const remaining = pendingGates(candidateId);
    return {
      output: {
        ok: true,
        recorded: criterion,
        passed,
        remainingCriteria: remaining,
        ...(remaining.length === 0 && { nextAction: 'All four criteria are recorded. Call finalize_screening_status now.' }),
      },
      effect: { kind: 'qualification', criterion, passed, note },
    };
  }

  if (name === 'finalize_screening_status') {
    const remaining = pendingGates(candidateId);
    if (remaining.length) {
      return {
        output: { ok: false, error: 'Not all criteria have been recorded yet.', remainingCriteria: remaining },
        effect: { kind: 'none' },
      };
    }
    const record = finalize(candidateId);
    const failed = CRITERIA.filter((c) => record.gates[c].status === 'failed').map((c) => JOB.gates[c].label);
    return {
      output: {
        ok: true,
        overallQualified: record.outcome!.overallQualified,
        recommendedNextStep: record.outcome!.recommendedNextStep,
        failedRequirements: failed,
      },
      effect: { kind: 'finalized', record },
    };
  }

  return { output: { ok: false, error: `Unknown tool "${name}".` }, effect: { kind: 'none' } };
}
