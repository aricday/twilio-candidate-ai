import OpenAI from 'openai';
import { config } from '../config';
import { icimsTools } from './tools';

// Created on first use so the server still starts (and logs a warning) without OPENAI_API_KEY.
let openai: OpenAI | undefined;

export interface StreamedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface CompletionResult {
  content: string;
  toolCalls: StreamedToolCall[];
}

/**
 * Streams one completion. Text tokens are handed to `onToken` as they arrive so they can be
 * forwarded to ConversationRelay immediately; tool-call deltas are accumulated and returned.
 */
export async function streamCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<CompletionResult> {
  openai ??= new OpenAI();
  const stream = await openai.chat.completions.create(
    {
      model: config.openai.model,
      messages,
      tools: icimsTools,
      stream: true,
      // No reasoning: fastest time-to-first-token (DECISIONS.md, Decision 1).
      reasoning_effort: 'none',
    },
    { signal },
  );

  let content = '';
  const toolCalls: StreamedToolCall[] = [];

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      onToken(delta.content);
    }

    for (const tc of delta.tool_calls ?? []) {
      const call = (toolCalls[tc.index] ??= { id: '', name: '', arguments: '' });
      if (tc.id) call.id = tc.id;
      if (tc.function?.name) call.name += tc.function.name;
      if (tc.function?.arguments) call.arguments += tc.function.arguments;
    }
  }

  return { content, toolCalls: toolCalls.filter(Boolean) };
}
