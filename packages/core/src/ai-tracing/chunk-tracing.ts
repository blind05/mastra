/**
 * LLM Chunk Tracing
 *
 * Provides span tracking for individual LLM streaming chunks within a larger LLM generation.
 * Each LLM_CHUNK span represents a single semantic unit (text block, tool call, reasoning block).
 */

import { TransformStream } from 'stream/web';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import { AISpanType } from './types';
import type { AISpan } from './types';

/**
 * Manages LLM_CHUNK span tracking for streaming LLM responses.
 *
 * Maintains a sequence number across all chunks in a single LLM_GENERATION.
 * Should be instantiated once per LLM_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
export class ChunkSpanTracker {
  private modelSpan?: AISpan<AISpanType.LLM_GENERATION>;
  private chunkSpan?: AISpan<AISpanType.LLM_CHUNK>;
  private completedSpans: AISpan<AISpanType.LLM_CHUNK>[] = [];
  private accumulator: string = '';
  private isEnabled: boolean;

  constructor(modelSpan?: AISpan<AISpanType.LLM_GENERATION>) {
    this.modelSpan = modelSpan;
    // Only enable tracking if we have a model span
    this.isEnabled = !!modelSpan;
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  startSpan(chunkType: string, input?: any) {
    if (!this.isEnabled) return;

    this.chunkSpan = this.modelSpan?.createChildSpan({
      name: `chunk: ${chunkType}`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.completedSpans.length,
      },
      input,
    });
    this.accumulator = '';
  }

  /**
   * Add content to the accumulator for the current span
   */
  accumulate(content: string) {
    if (!this.isEnabled) return;
    this.accumulator += content;
  }

  /**
   * End the current span and add it to completed spans
   */
  endCurrentSpan() {
    if (!this.isEnabled || !this.chunkSpan) return;

    this.chunkSpan.end({
      output: this.accumulator,
    });
    this.completedSpans.push(this.chunkSpan);
    this.chunkSpan = undefined;
    this.accumulator = '';
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  createEventSpan(chunkType: string, output: any) {
    if (!this.isEnabled) return;

    const span = this.modelSpan?.createEventSpan({
      name: `chunk: ${chunkType}`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.completedSpans.length,
      },
      output,
    });

    if (span) {
      this.completedSpans.push(span);
    }
  }

  /**
   * Get all completed spans
   */
  getCompletedSpans(): AISpan<AISpanType.LLM_CHUNK>[] {
    return this.completedSpans;
  }
}

/**
 * Creates a transform stream that tracks LLM chunks as spans.
 *
 * This should be added to the stream pipeline to automatically
 * create LLM_CHUNK spans for each semantic chunk in the stream.
 */
export function createChunkTracingTransform<OUTPUT extends OutputSchema>(
  tracker: ChunkSpanTracker | undefined,
): TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>> {
  return new TransformStream({
    transform(chunk, controller) {
      if (!tracker) {
        if (process.env.CHUNK_TRACING_DEBUG === 'true') {
          console.log('[ChunkTracing] No tracker, skipping chunk:', chunk.type);
        }
        controller.enqueue(chunk);
        return;
      }

      if (process.env.CHUNK_TRACING_DEBUG === 'true') {
        console.log('[ChunkTracing] Processing chunk:', chunk.type, tracker);
      }

      // Handle chunk span tracking based on chunk type
      switch (chunk.type) {
        case 'text-start':
          tracker.startSpan('text');
          break;

        case 'text-delta':
          // Accumulate text for the current text span (started by text-start)
          tracker.accumulate(chunk.payload.text);
          break;

        case 'text-end':
          tracker.endCurrentSpan();
          break;

        case 'tool-call-input-streaming-start':
          tracker.startSpan('tool-input', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
          });
          break;

        case 'tool-call-delta':
          // Accumulate args text for LLM_CHUNK span
          tracker.accumulate(chunk.payload.argsTextDelta);
          break;

        case 'tool-call-input-streaming-end':
          tracker.endCurrentSpan();
          break;

        case 'reasoning-start':
          tracker.startSpan('reasoning', {});
          break;

        case 'reasoning-delta':
          // Accumulate reasoning text for LLM_CHUNK span
          tracker.accumulate(chunk.payload.text);
          break;

        case 'reasoning-end':
          tracker.endCurrentSpan();
          break;

        case 'tool-call':
          // Create event span for tool execution
          tracker.createEventSpan('tool-execution', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
            args: chunk.payload.args,
          });
          break;
      }

      controller.enqueue(chunk);
    },
  });
}
