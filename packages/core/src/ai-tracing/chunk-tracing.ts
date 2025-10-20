/**
 * LLM Model Span Tracing
 *
 * Provides span tracking for LLM generations, including:
 * - LLM_STEP spans (one per LLM API call)
 * - LLM_CHUNK spans (individual streaming chunks within a step)
 *
 * Hierarchy: LLM_GENERATION -> LLM_STEP -> LLM_CHUNK
 */

import { TransformStream } from 'stream/web';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import { AISpanType } from './types';
import type { AISpan } from './types';

/**
 * Manages LLM_STEP and LLM_CHUNK span tracking for streaming LLM responses.
 *
 * Should be instantiated once per LLM_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
export class ModelSpanTracker {
  private modelSpan?: AISpan<AISpanType.LLM_GENERATION>;
  private currentStepSpan?: AISpan<AISpanType.LLM_STEP>;
  private currentChunkSpan?: AISpan<AISpanType.LLM_CHUNK>;
  private completedChunkSpans: AISpan<AISpanType.LLM_CHUNK>[] = [];
  private accumulator: Record<string, any> = {};
  private stepIndex: number = 0;
  private chunkSequence: number = 0;
  private pendingTokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  private isEnabled: boolean;

  constructor(modelSpan?: AISpan<AISpanType.LLM_GENERATION>) {
    this.modelSpan = modelSpan;
    // Only enable tracking if we have a model span
    this.isEnabled = !!modelSpan;
  }

  /**
   * Start a new LLM execution step
   */
  startStep() {
    if (!this.isEnabled) return;

    this.currentStepSpan = this.modelSpan?.createChildSpan({
      name: `step ${this.stepIndex}`,
      type: AISpanType.LLM_STEP,
      attributes: {
        stepIndex: this.stepIndex,
      },
    });
    // Reset chunk sequence for new step
    this.chunkSequence = 0;
    this.pendingTokenUsage = undefined;
  }

  /**
   * End the current LLM execution step
   */
  endStep(finishReason?: string) {
    if (!this.isEnabled || !this.currentStepSpan) return;

    // Apply token usage if we have it
    if (this.pendingTokenUsage) {
      this.currentStepSpan.update({
        attributes: {
          ...this.pendingTokenUsage,
          finishReason,
        },
      });
    } else if (finishReason) {
      this.currentStepSpan.update({
        attributes: {
          finishReason,
        },
      });
    }

    this.currentStepSpan.end({});
    this.currentStepSpan = undefined;
    this.stepIndex++;
  }

  /**
   * Store token usage from finish chunk (to be applied when step ends)
   */
  setTokenUsage(usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
    if (!this.isEnabled) return;
    this.pendingTokenUsage = usage;
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  startSpan(chunkType: string, initialData?: Record<string, any>) {
    if (!this.isEnabled) return;

    // Auto-create step if we see a chunk before step-start
    if (!this.currentStepSpan) {
      this.startStep();
    }

    this.currentChunkSpan = this.currentStepSpan?.createChildSpan({
      name: `chunk: ${chunkType}`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.chunkSequence,
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
   * End the current chunk span and add it to completed spans.
   * Safe to call multiple times - will no-op if span already ended.
   */
  endCurrentSpan(output?: any) {
    if (!this.isEnabled || !this.currentChunkSpan) return;

    this.currentChunkSpan.end({
      output: output !== undefined ? output : this.accumulator,
    });
    this.completedChunkSpans.push(this.currentChunkSpan);
    this.currentChunkSpan = undefined;
    this.accumulator = {};
    this.chunkSequence++;
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  createEventSpan(chunkType: string, output: any) {
    if (!this.isEnabled) return;

    // Auto-create step if we see a chunk before step-start
    if (!this.currentStepSpan) {
      this.startStep();
    }

    const span = this.currentStepSpan?.createEventSpan({
      name: `chunk: ${chunkType}`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.chunkSequence,
      },
      output,
    });

    if (span) {
      this.completedChunkSpans.push(span);
      this.chunkSequence++;
    }
  }

  /**
   * Check if there is currently an active chunk span
   */
  hasActiveSpan(): boolean {
    return !!this.currentChunkSpan;
  }

  /**
   * Get the current accumulator value
   */
  getAccumulator(): Record<string, any> {
    return this.accumulator;
  }

  /**
   * Get all completed chunk spans
   */
  getCompletedSpans(): AISpan<AISpanType.LLM_CHUNK>[] {
    return this.completedChunkSpans;
  }
}

/**
 * Creates a transform stream that tracks LLM steps and chunks as spans.
 *
 * This should be added to the stream pipeline to automatically
 * create LLM_STEP and LLM_CHUNK spans for each semantic unit in the stream.
 */
export function createChunkTracingTransform<OUTPUT extends OutputSchema>(
  tracker: ModelSpanTracker | undefined,
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

        // LLM Step management
        case 'step-start':
          tracker.startStep();
          break;

        case 'finish': {
          // Extract token usage from finish chunk
          const usage = (chunk.payload as any)?.usage;
          if (usage) {
            tracker.setTokenUsage({
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
            });
          }
          break;
        }

        case 'step-finish':
          // End step with finish reason from finish chunk (already stored)
          tracker.endStep();
          break;

        case 'raw': // Skip raw chunks as they're redundant
        case 'start':
          // don't output these chunks that don't have helpful output
          break;
      }



      controller.enqueue(chunk);
    },
  });
}
