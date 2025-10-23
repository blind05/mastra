import type { CoreMessage } from 'ai';

import type { Embedder } from '../../embeddings';
import type { MemoryRuntimeContext } from '../../memory/types';
import type { MastraMessageV2 } from '../../message';
import type { RuntimeContext } from '../../runtime-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { TracingContext } from '../../tracing';
import type { VectorStore } from '../../vector';
import type { InputProcessor } from '../index';

const DEFAULT_TOP_K = 5;
const DEFAULT_MESSAGE_RANGE = 2;

export interface SemanticRecallOptions {
  /**
   * Storage instance for retrieving messages
   */
  storage: MemoryStorage;

  /**
   * Vector store for semantic search
   */
  vector: VectorStore;

  /**
   * Embedder for generating query embeddings
   */
  embedder: Embedder;

  /**
   * Number of most similar messages to retrieve
   * @default 5
   */
  topK?: number;

  /**
   * Number of context messages to include before/after each match
   * Can be a number (same for before/after) or an object with before/after
   * @default 2
   */
  messageRange?: number | { before: number; after: number };

  /**
   * Scope of semantic search
   * - 'thread': Search within the current thread only
   * - 'resource': Search across all threads for the resource
   * @default 'thread'
   */
  scope?: 'thread' | 'resource';

  /**
   * Minimum similarity score threshold (0-1)
   * Messages below this threshold will be filtered out
   */
  threshold?: number;

  /**
   * Index name for the vector store
   * If not provided, will be auto-generated based on embedder model
   */
  indexName?: string;
}

/**
 * SemanticRecall is an input processor that performs semantic search
 * on historical messages and adds relevant context to the input.
 *
 * It uses vector embeddings to find messages similar to the user's query,
 * then retrieves those messages along with surrounding context.
 *
 * @example
 * ```typescript
 * const processor = new SemanticRecall({
 *   storage: memoryStorage,
 *   vector: vectorStore,
 *   embedder: openaiEmbedder,
 *   topK: 5,
 *   messageRange: 2,
 *   scope: 'resource'
 * });
 *
 * // Use with agent
 * const agent = new Agent({
 *   inputProcessors: [processor]
 * });
 * ```
 */
export class SemanticRecall implements InputProcessor {
  readonly name = 'SemanticRecall';

  private storage: MemoryStorage;
  private vector: VectorStore;
  private embedder: Embedder;
  private topK: number;
  private messageRange: { before: number; after: number };
  private scope: 'thread' | 'resource';
  private threshold?: number;
  private indexName?: string;

  constructor(options: SemanticRecallOptions) {
    this.storage = options.storage;
    this.vector = options.vector;
    this.embedder = options.embedder;
    this.topK = options.topK ?? DEFAULT_TOP_K;
    this.scope = options.scope ?? 'thread';
    this.threshold = options.threshold;
    this.indexName = options.indexName;

    // Normalize messageRange to object format
    if (typeof options.messageRange === 'number') {
      this.messageRange = {
        before: options.messageRange,
        after: options.messageRange,
      };
    } else if (options.messageRange) {
      this.messageRange = options.messageRange;
    } else {
      this.messageRange = {
        before: DEFAULT_MESSAGE_RANGE,
        after: DEFAULT_MESSAGE_RANGE,
      };
    }
  }

  async processInput(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RuntimeContext;
  }): Promise<MastraMessageV2[]> {
    const { messages, runtimeContext } = args;

    // Get memory context from RuntimeContext
    const memoryContext = runtimeContext?.get<MemoryRuntimeContext>('MastraMemory');
    if (!memoryContext) {
      // No memory context available, return messages unchanged
      return messages;
    }

    const { thread, resourceId } = memoryContext;
    const threadId = thread?.id;

    if (!threadId) {
      // No thread ID available, return messages unchanged
      return messages;
    }

    // Extract user query from the last user message
    const userQuery = this.extractUserQuery(messages);
    if (!userQuery) {
      // No user query to search with, return messages unchanged
      return messages;
    }

    try {
      // Perform semantic search
      const similarMessages = await this.performSemanticSearch({
        query: userQuery,
        threadId,
        resourceId,
      });

      if (similarMessages.length === 0) {
        // No similar messages found, return original messages
        return messages;
      }

      // Filter out messages that are already in the input
      const existingIds = new Set(messages.map(m => m.id).filter(Boolean));
      const newMessages = similarMessages.filter(m => !existingIds.has(m.id));

      if (newMessages.length === 0) {
        // All similar messages are already in input, return original
        return messages;
      }

      // Prepend similar messages to input
      // They come first so they provide context for the new user message
      return [...newMessages, ...messages];
    } catch (error) {
      // Log error but don't fail the request
      console.error('[SemanticRecall] Error during semantic search:', error);
      return messages;
    }
  }

  /**
   * Extract the user query from messages for semantic search
   */
  private extractUserQuery(messages: MastraMessageV2[]): string | null {
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'user') {
        // Extract text content from the message
        if (typeof msg.content === 'string') {
          return msg.content;
        } else if (Array.isArray(msg.content)) {
          // Handle multi-part content
          const textParts = msg.content.filter(part => part.type === 'text').map(part => part.text);
          return textParts.join(' ');
        }
      }
    }
    return null;
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch({
    query,
    threadId,
    resourceId,
  }: {
    query: string;
    threadId: string;
    resourceId?: string;
  }): Promise<MastraMessageV2[]> {
    // Generate embeddings for the query
    const { embeddings, dimension } = await this.embedMessageContent(query);

    // Ensure vector index exists
    const indexName = this.indexName || this.getDefaultIndexName();
    await this.ensureVectorIndex(indexName, dimension);

    // Perform vector search for each embedding
    const vectorResults: Array<{
      id: string;
      score: number;
      metadata?: Record<string, any>;
    }> = [];

    for (const embedding of embeddings) {
      const results = await this.vector.query({
        indexName,
        queryVector: embedding,
        topK: this.topK,
        filter: this.scope === 'resource' && resourceId ? { resource_id: resourceId } : { thread_id: threadId },
      });

      vectorResults.push(...results);
    }

    // Filter by threshold if specified
    const filteredResults =
      this.threshold !== undefined ? vectorResults.filter(r => r.score >= this.threshold!) : vectorResults;

    if (filteredResults.length === 0) {
      return [];
    }

    // Retrieve messages with context
    const messages = await this.storage.getMessages({
      threadId,
      resourceId,
      format: 'v2',
      selectBy: {
        include: filteredResults.map(r => ({
          id: r.metadata?.message_id,
          threadId: r.metadata?.thread_id,
          withNextMessages: this.messageRange.after,
          withPreviousMessages: this.messageRange.before,
        })),
      },
    });

    return messages;
  }

  /**
   * Generate embeddings for message content
   */
  private async embedMessageContent(content: string): Promise<{
    embeddings: number[][];
    dimension: number;
  }> {
    const result = await this.embedder.embed({
      values: [content],
    });

    return {
      embeddings: result.embeddings,
      dimension: result.embeddings[0]?.length || 0,
    };
  }

  /**
   * Get default index name based on embedder model
   */
  private getDefaultIndexName(): string {
    const model = this.embedder.model || 'default';
    return `mastra-memory-${model}`;
  }

  /**
   * Ensure vector index exists with correct dimensions
   */
  private async ensureVectorIndex(indexName: string, dimension: number): Promise<void> {
    try {
      // Check if index exists
      const indexes = await this.vector.listIndexes();
      const indexExists = indexes.some(idx => idx.name === indexName);

      if (!indexExists) {
        // Create index if it doesn't exist
        await this.vector.createIndex({
          name: indexName,
          dimension,
          metric: 'cosine',
        });
      }
    } catch (error) {
      console.error('[SemanticRecall] Error ensuring vector index:', error);
      throw error;
    }
  }

  /**
   * Convert CoreMessage to string for embedding
   */
  private coreMessageToString(message: CoreMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map(part => {
          if (part.type === 'text') {
            return part.text;
          }
          return '';
        })
        .join(' ');
    }

    return '';
  }
}
