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
  private accumulator: Record<string, any> = {};
  private isEnabled: boolean;

  constructor(modelSpan?: AISpan<AISpanType.LLM_GENERATION>) {
    this.modelSpan = modelSpan;
    // Only enable tracking if we have a model span
    this.isEnabled = !!modelSpan;
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  startSpan(chunkType: string, initialData?: Record<string, any>) {
    if (!this.isEnabled) return;

    this.chunkSpan = this.modelSpan?.createChildSpan({
      name: `chunk: ${chunkType}`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.completedSpans.length,
      },
    });
    this.accumulator = initialData || {};
  }

  /**
   * Update accumulator with new fields (merges into existing accumulator)
   */
  updateAccumulator(updates: Record<string, any>) {
    if (!this.isEnabled) return;
    Object.assign(this.accumulator, updates);
  }

  /**
   * Append string content to a specific field in the accumulator
   */
  appendToAccumulator(field: string, text: string) {
    if (!this.isEnabled) return;
    if (this.accumulator[field] === undefined) {
      this.accumulator[field] = text;
    } else {
      this.accumulator[field] += text;
    }
  }

  /**
   * End the current span and add it to completed spans.
   * Safe to call multiple times - will no-op if span already ended.
   */
  endCurrentSpan(output?: any) {
    if (!this.isEnabled || !this.chunkSpan) return;

    this.chunkSpan.end({
      output: output !== undefined ? output : this.accumulator,
    });
    this.completedSpans.push(this.chunkSpan);
    this.chunkSpan = undefined;
    this.accumulator = {};
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
   * Check if there is currently an active span
   */
  hasActiveSpan(): boolean {
    return !!this.chunkSpan;
  }

  /**
   * Get the current accumulator value
   */
  getAccumulator(): Record<string, any> {
    return this.accumulator;
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
        controller.enqueue(chunk);
        return;
      }

      // Handle chunk span tracking based on chunk type
      switch (chunk.type) {
        // Text generation (multi-part span)
        case 'text-start':
          tracker.startSpan('text');
          break;

        case 'text-delta':
          tracker.appendToAccumulator('text', chunk.payload.text);
          break;

        case 'text-end': {
          const acc = tracker.getAccumulator();
          tracker.endCurrentSpan(acc.text);
          break;
        }

        // Tool call with streaming input (multi-part span)
        case 'tool-call-input-streaming-start':
          tracker.startSpan('tool-call', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
          });
          break;

        case 'tool-call-delta':
          tracker.appendToAccumulator('toolInput', chunk.payload.argsTextDelta);
          break;

        case 'tool-call-input-streaming-end':
        case 'tool-call': {
          // Build output with toolName, toolCallId, and parsed toolInput
          const acc = tracker.getAccumulator();
          let toolInput;
          try {
            toolInput = acc.toolInput ? JSON.parse(acc.toolInput) : {};
          } catch {
            toolInput = acc.toolInput; // Keep as string if parsing fails
          }
          tracker.endCurrentSpan({
            toolName: acc.toolName,
            toolCallId: acc.toolCallId,
            toolInput,
          });
          break;
        }

        // Reasoning (multi-part span)
        case 'reasoning-start':
          tracker.startSpan('reasoning');
          break;

        case 'reasoning-delta':
          tracker.appendToAccumulator('text', chunk.payload.text);
          break;

        case 'reasoning-end': {
          const acc = tracker.getAccumulator();
          tracker.endCurrentSpan(acc.text);
          break;
        }

        // Event spans (single point in time chunks)
        case 'response-metadata':
          tracker.createEventSpan('response-metadata', chunk.payload);
          break;

        case 'reasoning-signature':
          tracker.createEventSpan('reasoning-signature', chunk.payload);
          break;

        case 'redacted-reasoning':
          tracker.createEventSpan('redacted-reasoning', chunk.payload);
          break;

        case 'source':
          tracker.createEventSpan('source', {
            sourceType: chunk.payload.sourceType,
            title: chunk.payload.title,
            url: chunk.payload.url,
          });
          break;

        case 'file':
          tracker.createEventSpan('file', {
            mimeType: chunk.payload.mimeType,
            size: chunk.payload.data?.length,
          });
          break;

        case 'tool-result':
          tracker.createEventSpan('tool-result', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
            result: chunk.payload.result,
            isError: chunk.payload.isError,
          });
          break;

        case 'tool-error':
          tracker.createEventSpan('tool-error', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
            error: chunk.payload.error,
          });
          break;

        case 'tool-output':
          tracker.createEventSpan('tool-output', chunk.payload);
          break;

        case 'tool-call-approval':
          tracker.createEventSpan('tool-call-approval', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
            args: chunk.payload.args,
          });
          break;

        case 'tool-call-suspended':
          tracker.createEventSpan('tool-call-suspended', {
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
          });
          break;

        case 'object':
          // Start span on first partial object chunk (only if not already started)
          // Multiple object chunks may arrive as the object is being generated
          if (!tracker.hasActiveSpan()) {
            tracker.startSpan('object');
          }
          break;

        case 'object-result':
          // End the span with the final complete object as output
          tracker.endCurrentSpan(chunk.object);
          break;

        case 'step-output':
          tracker.createEventSpan('step-output', chunk.payload);
          break;

        case 'error':
          tracker.createEventSpan('error', {
            error: chunk.payload.error,
          });
          break;

        case 'abort':
          tracker.createEventSpan('abort', chunk.payload);
          break;

        case 'watch':
        case 'tripwire':
          // Infrastructure chunks - track for debugging
          tracker.createEventSpan(chunk.type, chunk.payload);
          break;

        case 'raw': // Skip raw chunks as they're redundant
        case 'start':
        case 'finish':
        case 'step-start':
        case 'step-finish':
          // don't output these steps that don't have helpful output
          break;
      }



      controller.enqueue(chunk);
    },
  });
}
