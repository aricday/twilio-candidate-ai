// One ConversationRelay WebSocket session = one screening call (PRD §6.4, with the fixes in DECISIONS.md).
import type OpenAI from 'openai';
import type { WebSocket } from 'ws';
import type { EdgeId, Step, UiEvent } from '../../shared/types';
import { streamCompletion } from '../ai/llm';
import { buildIcimsSystemPrompt, buildWelcomeGreeting } from '../ai/systemPrompt';
import { runTool, type ToolEffect } from '../ai/tools';
import { finalize, getCandidate, JOB, pendingGates, resetRecord } from '../ats/store';
import { config } from '../config';
import { emit, isValidUiSessionId, registerInjector } from '../ui/hub';

type Message = OpenAI.Chat.ChatCompletionMessageParam;

/** Upper bound on model round trips per turn (text + tool calls + follow-up). */
const MAX_ROUNDS = 4;
const GOODBYE_LEAD_MS = 8000;

interface Turn {
  controller: AbortController;
  aiId: string;
  /** Everything streamed to TTS so far this turn. */
  spoken: string;
  /** Text streamed in the current model round only (not yet in `messages`). */
  roundText: string;
  /** Set once the turn's history has been committed after an abort. */
  committed: boolean;
}

export function handleRelayConnection(ws: WebSocket): void {
  new ScreeningSession(ws);
}

class ScreeningSession {
  private messages: Message[] = [];
  private candidateId = '';
  private uiSessionId = '';
  private turn: Turn | null = null;
  private userTurnId: string | null = null;
  private turnCount = 0;
  private finalized = false;
  private timers: NodeJS.Timeout[] = [];
  private unregisterInjector = () => {};

  constructor(private ws: WebSocket) {
    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.onMessage(msg).catch((err) => console.error('[relay] handler error', err));
    });
    ws.on('close', () => this.onClose());
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(message));
  }

  private ui(event: UiEvent): void {
    emit(this.uiSessionId, event);
  }

  private hop(step: Step, edges: EdgeId[], label: string, detail?: string, ms?: number, turnStart?: boolean): void {
    // Once the screening is finalized, the rest of the call (wrap-up, final questions) is the ATS handoff phase.
    const phase: Step = this.finalized ? 3 : step;
    console.log(`[hop] step ${phase} • ${label}${ms !== undefined ? ` (${ms}ms)` : ''}${detail ? ` • ${detail}` : ''}`);
    this.ui({ type: 'hop', step: phase, edges, label, detail, ms, turnStart, ts: Date.now() });
  }

  private async onMessage(msg: any): Promise<void> {
    switch (msg.type) {
      case 'setup':
        return this.onSetup(msg);
      case 'prompt':
        return this.onPrompt(msg);
      case 'interrupt':
        return this.onInterrupt(msg);
      case 'dtmf':
        this.hop(2, ['browser-voice', 'voice-relay', 'relay-backend'], 'Keypad (DTMF) received', `digit: ${msg.digit}`);
        return;
      case 'error':
        console.error('[relay] ConversationRelay error:', msg.description);
        this.hop(2, ['relay-backend'], 'ConversationRelay error', msg.description);
        return;
    }
  }

  private onSetup(msg: any): void {
    const params = msg.customParameters ?? {};
    const candidate = getCandidate(params.candidateId);
    this.candidateId = candidate.id;
    this.uiSessionId = isValidUiSessionId(params.uiSessionId) ? params.uiSessionId : '';
    resetRecord(candidate.id);

    // ConversationRelay already spoke the welcome greeting; put it in history so the model doesn't repeat it.
    const greeting = buildWelcomeGreeting(candidate);
    this.messages = [
      { role: 'system', content: buildIcimsSystemPrompt(candidate) },
      { role: 'assistant', content: greeting },
    ];

    if (this.uiSessionId) {
      this.unregisterInjector = registerInjector(this.uiSessionId, (text) => {
        this.runTurn(text, 'chip').catch((err) => console.error('[relay] injected turn failed', err));
      });
    }

    this.hop(
      1,
      ['voice-relay', 'relay-backend'],
      'WebSocket connected',
      `CustomParams: { candidateId: '${candidate.id}', jobId: '${params.jobId ?? JOB.id}' }`,
    );
    this.ui({ type: 'transcript', id: 'ai-greeting', role: 'ai', text: greeting, final: true });

    // PRD §7: hard 5-minute cap. Say goodbye shortly before, then end the session.
    const max = Math.max(config.maxCallMs, GOODBYE_LEAD_MS + 2000);
    this.timers.push(
      setTimeout(() => {
        if (this.turn) this.abortTurn(this.turn);
        this.send({
          type: 'text',
          token:
            "We've reached the five minute limit for this demo call. Thanks so much for your time, and have a great day!",
          last: true,
        });
        this.hop(2, ['relay-backend', 'voice-relay', 'browser-voice'], 'Call time limit reached', 'Speaking goodbye');
      }, max - GOODBYE_LEAD_MS),
      setTimeout(() => {
        this.send({ type: 'end', handoffData: JSON.stringify({ reason: 'max-duration' }) });
      }, max),
    );
  }

  private async onPrompt(msg: any): Promise<void> {
    const text: string = msg.voicePrompt ?? '';

    // Partial prompts (turnState "start" / "interim") only drive the live UI — never the LLM
    // (DECISIONS.md, Decision 6).
    if (!msg.last) {
      if (!this.userTurnId) {
        this.userTurnId = `user-${++this.turnCount}`;
        this.ui({ type: 'listening', active: true });
        this.hop(
          2,
          ['browser-voice', 'voice-relay', 'relay-backend'],
          'Candidate speaking',
          'turnState: start • Flux streaming STT',
          undefined,
          true,
        );
      }
      if (text) this.ui({ type: 'transcript', id: this.userTurnId, role: 'user', text, final: false });
      return;
    }

    const userId = this.userTurnId ?? undefined;
    this.userTurnId = null;
    this.ui({ type: 'listening', active: false });
    await this.runTurn(text, 'voice', userId);
  }

  /** `userId` is set when partial prompts already opened this turn in the UI. */
  private async runTurn(text: string, source: 'voice' | 'chip', userId?: string): Promise<void> {
    if (!text.trim()) return;
    if (this.turn) this.abortTurn(this.turn);

    const id = userId ?? `user-${++this.turnCount}`;
    this.ui({ type: 'transcript', id, role: 'user', text, final: true });
    this.messages.push({ role: 'user', content: text });

    const startedAt = Date.now();
    this.hop(
      2,
      ['relay-backend', 'backend-openai'],
      source === 'chip' ? `Prompt chip → ${config.openai.model}` : `Final transcript → ${config.openai.model}`,
      `${source === 'chip' ? 'injected from UI' : 'turnState: end'} • "${truncate(text, 60)}"`,
      undefined,
      !userId,
    );

    const turn: Turn = { controller: new AbortController(), aiId: `ai-${id}`, spoken: '', roundText: '', committed: false };
    this.turn = turn;
    let firstToken = true;

    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        turn.roundText = '';
        const result = await streamCompletion(this.messages, turn.controller.signal, (token) => {
          if (turn.controller.signal.aborted) return;
          if (firstToken) {
            firstToken = false;
            this.hop(
              2,
              ['backend-openai', 'relay-backend', 'voice-relay', 'browser-voice'],
              `First token from ${config.openai.model}`,
              'Streaming text tokens → ConversationRelay TTS',
              Date.now() - startedAt,
            );
          }
          turn.roundText += token;
          turn.spoken += token;
          this.send({ type: 'text', token, last: false });
          this.ui({ type: 'transcript', id: turn.aiId, role: 'ai', text: turn.spoken, final: false });
        });
        if (turn.committed) return;

        const assistant: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: result.content || null,
        };
        if (result.toolCalls.length) {
          assistant.tool_calls = result.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        this.messages.push(assistant);
        turn.roundText = '';

        if (!result.toolCalls.length) break;

        for (const tc of result.toolCalls) {
          const { output, effect } = runTool(this.candidateId, tc.name, tc.arguments);
          this.messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(output) });
          this.reportToolEffect(tc.name, effect, output);
        }

        // Latency: if the model already spoke its next question alongside the tool call, the turn is
        // complete — skip the extra round trip. Otherwise go back to the model for the spoken reply.
        // Never skip when all gates are in but the screening isn't finalized yet.
        const awaitingFinalize = !this.finalized && pendingGates(this.candidateId).length === 0;
        if (result.content.trim().endsWith('?') && !awaitingFinalize) break;
      }

      // Safety net: all four gates are recorded but the model never called finalize_screening_status.
      if (!this.finalized && pendingGates(this.candidateId).length === 0) {
        console.warn('[relay] Model did not finalize after all gates were recorded; finalizing server-side');
        this.reportToolEffect('finalize_screening_status (server)', { kind: 'finalized', record: finalize(this.candidateId) }, {});
      }

      this.send({ type: 'text', token: '', last: true });
      this.ui({ type: 'transcript', id: turn.aiId, role: 'ai', text: turn.spoken, final: true });
      this.hop(
        2,
        ['relay-backend', 'voice-relay', 'browser-voice'],
        'AI response streamed',
        `${turn.spoken.split(/\s+/).filter(Boolean).length} words`,
        Date.now() - startedAt,
      );
    } catch (err) {
      if (turn.controller.signal.aborted) return; // barge-in or superseded; history already committed
      console.error('[relay] OpenAI turn failed', err);
      this.send({ type: 'text', token: 'Sorry, I had a hiccup on my end. Could you say that again?', last: true });
      this.hop(2, ['backend-openai'], 'OpenAI error', err instanceof Error ? err.message : String(err));
    } finally {
      if (this.turn === turn) this.turn = null;
    }
  }

  /**
   * Stops an in-flight turn and synchronously commits what the candidate actually heard, so history
   * is correct before any new user message is appended.
   */
  private abortTurn(turn: Turn, heardThisTurn?: string): void {
    if (turn.committed) return;
    turn.committed = true;
    turn.controller.abort();
    if (this.turn === turn) this.turn = null;

    const committedBefore = turn.spoken.length - turn.roundText.length;
    let partial = turn.roundText;
    if (heardThisTurn !== undefined) {
      partial = heardThisTurn.length > committedBefore ? heardThisTurn.slice(committedBefore) : '';
    }
    if (partial.trim()) this.messages.push({ role: 'assistant', content: `${partial.trim()} —` });
  }

  private onInterrupt(msg: any): void {
    const heard: string = msg.utteranceUntilInterrupt ?? '';
    this.hop(
      2,
      ['browser-voice', 'voice-relay', 'relay-backend'],
      'Barge-in interrupt',
      `Interrupted at: "${truncate(heard, 60)}" (${msg.durationUntilInterruptMs ?? '?'}ms)`,
    );

    if (this.turn) {
      const { aiId } = this.turn;
      this.abortTurn(this.turn, heard);
      this.ui({ type: 'transcript', id: aiId, role: 'ai', text: heard || '…', final: true, interrupted: true });
      return;
    }

    // The model had finished streaming but TTS was still playing: trim the last reply to what was heard.
    const last = [...this.messages].reverse().find((m) => m.role === 'assistant' && typeof m.content === 'string');
    if (last && heard && typeof last.content === 'string' && heard.length < last.content.length) {
      last.content = `${heard.trim()} —`;
    }
  }

  private reportToolEffect(name: string, effect: ToolEffect, output: Record<string, unknown>): void {
    switch (effect.kind) {
      case 'qualification':
        this.ui({ type: 'qualification', criterion: effect.criterion, passed: effect.passed, note: effect.note });
        this.hop(
          2,
          ['backend-ats'],
          'Tool call → iCIMS stub ATS',
          `${name} • ${JOB.gates[effect.criterion].label} = ${effect.passed ? 'TRUE' : 'FALSE'}`,
        );
        return;
      case 'finalized': {
        this.finalized = true;
        const { outcome, gates } = effect.record;
        const passed = Object.values(gates).filter((g) => g.status === 'passed').length;
        this.ui({ type: 'screening-complete', record: effect.record });
        this.hop(3, ['backend-ats'], 'ATS handoff: candidate record updated', `${outcome!.recommendedNextStep} • ${passed}/4 gates passed`);
        return;
      }
      case 'none':
        this.hop(2, ['backend-ats'], `Tool call rejected: ${name}`, String(output.error ?? ''));
    }
  }

  private onClose(): void {
    this.timers.forEach(clearTimeout);
    if (this.turn) this.abortTurn(this.turn);
    this.unregisterInjector();
    this.ui({ type: 'listening', active: false });
    this.ui({ type: 'call-ended', reason: 'ConversationRelay session closed' });
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
