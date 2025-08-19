import type { AISpanDatabaseRecord } from '@mastra/core/ai-tracing';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN, safelyParseJSON } from '@mastra/core/storage';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace } from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';

export class ObservabilityMongoDB extends ObservabilityStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  async createAiSpan(span: Omit<AISpanDatabaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const id = `${span.traceId}-${span.spanId}`;
      await this.operations.insert({
        tableName: TABLE_AI_SPAN,
        record: { ...span, id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAiSpan(id: string): Promise<Record<string, any> | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPAN);
      const result = await collection.findOne({ id });

      if (!result) {
        return null;
      }

      return this.transformRowToAISpan(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_GET_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI span: ${error}`,
      );
    }
  }

  async updateAiSpan(id: string, updates: Partial<AISpanDatabaseRecord>): Promise<void> {
    try {
      // First check if the span exists
      const existingSpan = await this.getAiSpan(id);
      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'MONGODB_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined));

      if (Object.keys(cleanUpdates).length === 0) {
        return; // No updates to make
      }

      const collection = await this.operations.getCollection(TABLE_AI_SPAN);
      await collection.updateOne({ id }, { $set: cleanUpdates });
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAiSpan(id: string): Promise<void> {
    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPAN);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_DELETE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to delete AI span: ${error}`,
      );
    }
  }

  /**
   * Builds filter conditions for AI span queries.
   * Supported filters:
   * - name: string (regex search with case-insensitive)
   * - attributes: object (JSON field filtering)
   * - error: object (JSON field filtering)
   * - createdAt: Date (>= comparison) or string (exact match)
   * - traceId: string (exact match)
   * - spanType: number (exact match)
   */
  private buildFilterConditions(filters?: any): any {
    const query: any = {};

    if (!filters) {
      return query;
    }

    // Name filtering
    if (filters.name) {
      query.name = filters.name; // Exact match
    }

    // Attributes filtering (JSON field)
    if (filters.attributes && typeof filters.attributes === 'object') {
      Object.entries(filters.attributes).forEach(([key, value]) => {
        if (key.includes('.')) {
          // Handle nested JSON paths like 'service.name' using MongoDB dot notation
          query[`attributes.${key}`] = value;
        } else {
          query[`attributes.${key}`] = value;
        }
      });
    }

    // Error filtering (JSON field)
    if (filters.error && typeof filters.error === 'object') {
      Object.entries(filters.error).forEach(([key, value]) => {
        if (key.includes('.')) {
          // Handle nested JSON paths using MongoDB dot notation
          query[`error.${key}`] = value;
        } else {
          query[`error.${key}`] = value;
        }
      });
    }

    // CreatedAt filtering
    if (filters.createdAt !== undefined) {
      if (filters.createdAt instanceof Date) {
        query.createdAt = { $gte: filters.createdAt };
      } else {
        query.createdAt = filters.createdAt;
      }
    }

    // TraceId filtering
    if (filters.traceId !== undefined) {
      query.traceId = filters.traceId;
    }

    // SpanType filtering
    if (filters.spanType !== undefined) {
      query.spanType = filters.spanType;
    }

    return query;
  }

  async getAiTrace(traceId: string): Promise<AITrace | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPAN);
      const result = await collection.find({ traceId }).toArray();

      if (result.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: result.map(row => this.transformRowToAISpan(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_GET_AI_TRACE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI trace: ${error}`,
      );
    }
  }

  async getAiTracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    try {
      const { filters, page = 0, perPage = 10 } = args;
      const currentOffset = page * perPage;

      // Build filter conditions
      const query = this.buildFilterConditions(filters);

      // Add parent span filter to count only parent spans
      const countQuery = { ...query, parentSpanId: null };

      const collection = await this.operations.getCollection(TABLE_AI_SPAN);

      // Count total matching parent spans
      const total = await collection.countDocuments(countQuery);

      if (total === 0) {
        return {
          spans: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get paginated parent spans
      const parentResult = await collection
        .find(countQuery, {
          sort: { createdAt: -1 },
        })
        .limit(perPage)
        .skip(currentOffset)
        .toArray();

      const parentSpans = parentResult.map(row => this.transformRowToAISpan(row));

      // Get all child spans for the found parent spans
      let allSpans = [...parentSpans];
      if (parentSpans.length > 0) {
        const traceIds = parentSpans.map(span => span.traceId);

        const childResult = await collection
          .find({
            traceId: { $in: traceIds },
            parentSpanId: { $ne: null },
          })
          .toArray();

        const childSpans = childResult.map(row => this.transformRowToAISpan(row));
        allSpans = [...parentSpans, ...childSpans];
      }

      return {
        spans: allSpans,
        total,
        page,
        perPage,
        hasMore: total > currentOffset + perPage,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_GET_AI_SPANS_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI spans paginated: ${error}`,
      );
    }
  }

  private transformRowToAISpan(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      scope: safelyParseJSON(row.scope),
      attributes: safelyParseJSON(row.attributes),
      metadata: safelyParseJSON(row.metadata),
      events: safelyParseJSON(row.events),
      links: safelyParseJSON(row.links),
      input: safelyParseJSON(row.input),
      output: safelyParseJSON(row.output),
      error: safelyParseJSON(row.error),
    };
  }

  async batchAiSpanCreate(args: {
    records: Omit<AISpanDatabaseRecord, 'id' | 'createdAt' | 'updatedAt'>[];
  }): Promise<void> {
    if (args.records.length === 0) {
      return; // No records to insert
    }

    try {
      const recordsWithIds = args.records.map(record => ({
        ...record,
        id: `${record.traceId}-${record.spanId}`,
      }));

      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: recordsWithIds,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch create AI spans: ${error}`,
      );
    }
  }

  async batchAiSpanUpdate(args: { records: { id: string; updates: Partial<AISpanDatabaseRecord> }[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No updates to make
    }

    try {
      for (const { id, updates } of args.records) {
        await this.updateAiSpan(id, updates);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch update AI spans: ${error}`,
      );
    }
  }

  async batchAiSpanDelete(args: { ids: string[] }): Promise<void> {
    if (args.ids.length === 0) {
      return; // No IDs to delete
    }

    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPAN);
      await collection.deleteMany({ id: { $in: args.ids } });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch delete AI spans: ${error}`,
      );
    }
  }
}
