import type { MastraMessageV2 } from '../../agent/index.js';
import type { TracingContext } from '../../ai-tracing/index.js';
import type { MemoryStorage } from '../../storage/domains/memory/base.js';
import type { Processor } from '../index.js';

/**
 * Options for the MessageHistoryProcessor
 */
export interface MessageHistoryProcessorOptions {
  storage: MemoryStorage;
  threadId?: string;
  resourceId?: string;
  lastMessages?: number;
  includeSystemMessages?: boolean;
}

/**
 * Hybrid processor that handles both retrieval and persistence of message history.
 * - On input: Fetches historical messages from storage and prepends them
 * - On output: Persists new messages to storage (excluding system messages)
 * This replaces the memory logic previously in prepare-memory-step.ts
 */
export class MessageHistoryProcessor implements Processor {
  readonly name = 'MessageHistoryProcessor';
  private storage: MemoryStorage;
  private threadId?: string;
  private resourceId?: string;
  private lastMessages?: number;
  private includeSystemMessages: boolean;

  constructor(options: MessageHistoryProcessorOptions) {
    this.storage = options.storage;
    this.threadId = options.threadId;
    this.resourceId = options.resourceId;
    this.lastMessages = options.lastMessages;
    this.includeSystemMessages = options.includeSystemMessages ?? false;
  }

  async processInput(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;

    if (!this.threadId) {
      return messages;
    }

    try {
      // 1. Fetch historical messages from storage (as V2 format)
      const historicalMessages = await this.storage.getMessages({
        threadId: this.threadId,
        selectBy: {
          last: this.lastMessages,
        },
        format: 'v2',
      });

      // 2. Filter based on includeSystemMessages option
      const filteredMessages = historicalMessages.filter(msg => this.includeSystemMessages || msg.role !== 'system');

      // 3. Merge with incoming messages (avoiding duplicates by ID)
      const messageIds = new Set(messages.map(m => m.id).filter(Boolean));
      const uniqueHistoricalMessages = filteredMessages.filter(m => !m.id || !messageIds.has(m.id));

      return [...uniqueHistoricalMessages, ...messages];
    } catch (error) {
      console.warn('Failed to fetch message history:', error);
      // Fail open - return original messages if history fetch fails
      return messages;
    }
  }

  async processOutputResult(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;

    if (!this.threadId) {
      return messages;
    }

    try {
      // 1. Filter out ONLY system messages - keep everything else
      const messagesToSave = messages.filter(m => m.role !== 'system');

      if (messagesToSave.length === 0) {
        return messages;
      }

      // 2. Add IDs to messages that don't have them
      const messagesWithIds = messagesToSave.map(msg => ({
        ...msg,
        id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      // 3. Save to storage
      await this.storage.saveMessages({
        messages: messagesWithIds,
        format: 'v2',
      });

      // 4. Update thread metadata
      try {
        const thread = await this.storage.getThreadById({ threadId: this.threadId });
        if (thread) {
          const allMessages = await this.storage.getMessages({
            threadId: this.threadId,
            format: 'v2',
          });

          await this.storage.updateThread({
            id: this.threadId,
            title: thread.title || '',
            metadata: {
              ...thread.metadata,
              updatedAt: new Date(),
              lastMessageAt: new Date(),
              messageCount: allMessages?.length || 0,
            },
          });
        }
      } catch (updateError) {
        console.warn('Failed to update thread metadata:', updateError);
        // Continue even if thread update fails
      }

      return messages;
    } catch (error) {
      console.warn('Failed to save messages:', error);
      // Return original messages if storage fails
      return messages;
    }
  }
}
