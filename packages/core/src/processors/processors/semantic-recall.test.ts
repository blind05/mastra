import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Embedder } from '../../embeddings';
import type { MastraMessageV2 } from '../../message';
import { RuntimeContext } from '../../runtime-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { VectorStore } from '../../vector';

import { SemanticRecall } from './semantic-recall';

describe('SemanticRecall', () => {
  let mockStorage: MemoryStorage;
  let mockVector: VectorStore;
  let mockEmbedder: Embedder;
  let runtimeContext: RuntimeContext;

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      getMessages: vi.fn(),
    } as any;

    // Mock vector store
    mockVector = {
      query: vi.fn(),
      listIndexes: vi.fn(),
      createIndex: vi.fn(),
    } as any;

    // Mock embedder
    mockEmbedder = {
      embed: vi.fn(),
      model: 'text-embedding-3-small',
    } as any;

    // Setup runtime context with memory data
    runtimeContext = new RuntimeContext();
    runtimeContext.set('MastraMemory', {
      thread: { id: 'thread-1', resourceId: 'resource-1' },
      resourceId: 'resource-1',
    });
  });

  describe('Input Processing', () => {
    it('should perform semantic search and prepend similar messages', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 3,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'How do I use the API?',
        },
      ];

      const similarMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'API documentation needed',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Here is the API guide...',
        },
      ];

      // Mock embedder
      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Mock vector query
      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        {
          id: 'vec-1',
          score: 0.95,
          metadata: { message_id: 'msg-1', thread_id: 'thread-1' },
        },
        {
          id: 'vec-2',
          score: 0.92,
          metadata: { message_id: 'msg-2', thread_id: 'thread-1' },
        },
      ]);

      // Mock storage
      vi.mocked(mockStorage.getMessages).mockResolvedValue(similarMessages);

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should prepend similar messages
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-new');

      // Verify embedder was called with user query
      expect(mockEmbedder.embed).toHaveBeenCalledWith({
        values: ['How do I use the API?'],
      });

      // Verify vector query was called
      expect(mockVector.query).toHaveBeenCalledWith({
        indexName: 'mastra-memory-text-embedding-3-small',
        queryVector: [0.1, 0.2, 0.3],
        topK: 3,
        filter: { thread_id: 'thread-1' },
      });

      // Verify storage was called with correct parameters
      expect(mockStorage.getMessages).toHaveBeenCalledWith({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        format: 'v2',
        selectBy: {
          include: [
            {
              id: 'msg-1',
              threadId: 'thread-1',
              withNextMessages: 2,
              withPreviousMessages: 2,
            },
            {
              id: 'msg-2',
              threadId: 'thread-1',
              withNextMessages: 2,
              withPreviousMessages: 2,
            },
          ],
        },
      });
    });

    it('should respect topK limit', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        topK: 2,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Message 1' },
        { id: 'msg-2', role: 'assistant', content: 'Message 2' },
      ]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify topK was passed to vector query
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 2,
        }),
      );
    });

    it('should filter by threshold', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        threshold: 0.9,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      // Return results with varying scores
      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.85, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } }, // Below threshold
        { id: 'vec-3', score: 0.92, metadata: { message_id: 'msg-3', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Message 1' },
        { id: 'msg-3', role: 'user', content: 'Message 3' },
      ]);

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should only include messages above threshold
      expect(result).toHaveLength(3); // 2 similar + 1 new
      expect(result.find(m => m.id === 'msg-2')).toBeUndefined();

      // Verify storage was called with only messages above threshold
      expect(mockStorage.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          selectBy: {
            include: [expect.objectContaining({ id: 'msg-1' }), expect.objectContaining({ id: 'msg-3' })],
          },
        }),
      );
    });

    it('should apply scope filter for thread scope', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'thread',
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.getMessages).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify thread scope filter was applied
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { thread_id: 'thread-1' },
        }),
      );
    });

    it('should apply scope filter for resource scope', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        scope: 'resource',
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);
      vi.mocked(mockStorage.getMessages).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify resource scope filter was applied
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { resource_id: 'resource-1' },
        }),
      );
    });

    it('should handle no results gracefully', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      // No results from vector search
      vi.mocked(mockVector.query).mockResolvedValue([]);

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

      // Storage should not be called
      expect(mockStorage.getMessages).not.toHaveBeenCalled();
    });

    it('should handle vector store errors gracefully', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      // Simulate vector query error
      vi.mocked(mockVector.query).mockRejectedValue(new Error('Vector query failed'));

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages on error
      expect(result).toEqual(inputMessages);
    });

    it('should skip when no user message present', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello!',
        },
      ];

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

      // No embedder or vector calls should be made
      expect(mockEmbedder.embed).not.toHaveBeenCalled();
      expect(mockVector.query).not.toHaveBeenCalled();
    });

    it('should return original messages when no threadId', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      // Runtime context without thread
      const emptyContext = new RuntimeContext();

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext: emptyContext,
      });

      // Should return original messages unchanged
      expect(result).toEqual(inputMessages);

      // No embedder or vector calls should be made
      expect(mockEmbedder.embed).not.toHaveBeenCalled();
      expect(mockVector.query).not.toHaveBeenCalled();
    });

    it('should handle multi-part user messages', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should combine text parts
      expect(mockEmbedder.embed).toHaveBeenCalledWith({
        values: ['Part 1 Part 2'],
      });
    });

    it('should avoid duplicate message IDs', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Existing message',
        },
        {
          id: 'msg-new',
          role: 'user',
          content: 'New query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
        { id: 'vec-2', score: 0.92, metadata: { message_id: 'msg-2', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Existing message' },
        { id: 'msg-2', role: 'assistant', content: 'Similar message' },
      ]);

      const result = await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Should not duplicate msg-1
      expect(result).toHaveLength(3); // msg-2 (new from search) + msg-1 (existing) + msg-new
      expect(result.filter(m => m.id === 'msg-1')).toHaveLength(1);
    });

    it('should respect custom messageRange', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        messageRange: { before: 5, after: 3 },
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([
        { name: 'mastra-memory-text-embedding-3-small', dimension: 3 },
      ]);

      vi.mocked(mockVector.query).mockResolvedValue([
        { id: 'vec-1', score: 0.95, metadata: { message_id: 'msg-1', thread_id: 'thread-1' } },
      ]);

      vi.mocked(mockStorage.getMessages).mockResolvedValue([{ id: 'msg-1', role: 'user', content: 'Message 1' }]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify custom messageRange was used
      expect(mockStorage.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          selectBy: {
            include: [
              {
                id: 'msg-1',
                threadId: 'thread-1',
                withNextMessages: 3,
                withPreviousMessages: 5,
              },
            ],
          },
        }),
      );
    });

    it('should create vector index if it does not exist', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      // Index doesn't exist
      vi.mocked(mockVector.listIndexes).mockResolvedValue([]);
      vi.mocked(mockVector.createIndex).mockResolvedValue(undefined);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify index was created
      expect(mockVector.createIndex).toHaveBeenCalledWith({
        name: 'mastra-memory-text-embedding-3-small',
        dimension: 3,
        metric: 'cosine',
      });
    });

    it('should use custom index name if provided', async () => {
      const processor = new SemanticRecall({
        storage: mockStorage,
        vector: mockVector,
        embedder: mockEmbedder,
        indexName: 'custom-index',
      });

      const inputMessages: MastraMessageV2[] = [
        {
          id: 'msg-new',
          role: 'user',
          content: 'Test query',
        },
      ];

      vi.mocked(mockEmbedder.embed).mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });

      vi.mocked(mockVector.listIndexes).mockResolvedValue([{ name: 'custom-index', dimension: 3 }]);
      vi.mocked(mockVector.query).mockResolvedValue([]);

      await processor.processInput({
        messages: inputMessages,
        abort: vi.fn() as any,
        runtimeContext,
      });

      // Verify custom index name was used
      expect(mockVector.query).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'custom-index',
        }),
      );
    });
  });
});
