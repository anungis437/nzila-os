/**
 * AI Vector Search Service
 * 
 * Provides semantic search capabilities for clauses and precedents using OpenAI embeddings
 * and PostgreSQL pgvector for vector similarity search.
 * 
 * Features:
 * - Semantic clause search
 * - Similar clause recommendations
 * - Precedent matching by semantic similarity
 * - Hybrid search (vector + keyword)
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import { db } from '@/db';
import { cbaClause } from '@/db/schema';
import { eq, sql, and, or, SQL } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { embeddingCache } from './embedding-cache';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const _EMBEDDING_DIMENSIONS = 1536;

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface SemanticSearchOptions {
  limit?: number;
  threshold?: number; // Minimum similarity score (0-1)
  filters?: {
    clauseType?: string[];
    jurisdiction?: string;
    sector?: string;
    organizationId?: string;
  };
  hybridSearch?: {
    enabled: boolean;
    keywordWeight?: number; // 0-1, how much to weight keyword match vs semantic
  };
}

/**
 * Generate embedding vector for text using OpenAI
 * Uses Redis cache to reduce API calls and costs
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Check cache first
    const cachedEmbedding = await embeddingCache.getCachedEmbedding(text, EMBEDDING_MODEL);
    
    if (cachedEmbedding) {
      logger.debug('Using cached embedding', { 
        model: EMBEDDING_MODEL,
        textLength: text.length 
      });
      return cachedEmbedding;
    }

    // Cache miss - call AI SDK
    logger.info('Generating new embedding', { 
      model: EMBEDDING_MODEL,
      textLength: text.length,
      reason: 'cache_miss'
    });

    const ai = getAiClient();
    const response = await ai.embed({
      entityId: 'system',
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.EMBEDDINGS,
      input: text,
      dataClass: 'internal',
    });

    const embedding = response.embeddings[0];

    // Store in cache for future use (non-blocking)
    embeddingCache.setCachedEmbedding(text, EMBEDDING_MODEL, embedding).catch(err => {
      logger.warn('Failed to cache embedding', { error: err.message });
    });

    return embedding;
  } catch (error) {
    logger.error('Error generating embedding', { error });
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Semantic search for clauses using vector similarity
 */
export async function semanticClauseSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 10,
    threshold = 0.7,
    filters = {},
    hybridSearch = { enabled: false, keywordWeight: 0.3 },
  } = options;

  try {
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Build WHERE clause based on filters
    const whereConditions: (SQL<unknown> | undefined)[] = [];
    if (filters.clauseType && filters.clauseType.length > 0) {
      whereConditions.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        or(...filters.clauseType.map(type => eq(cbaClause.clauseType, type as any)))
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Perform vector similarity search using pgvector
    const results = await db.execute(sql`
      SELECT 
        id,
        clause_number,
        title,
        content,
        clause_type,
        article_number,
        tags,
        1 - (embedding <=> ${embeddingString}::vector) as similarity,
        ${hybridSearch.enabled ? sql`
          (1 - (embedding <=> ${embeddingString}::vector)) * ${1 - (hybridSearch.keywordWeight || 0.3)} +
          (CASE WHEN content ILIKE ${`%${query}%`} THEN ${hybridSearch.keywordWeight || 0.3} ELSE 0 END) as hybrid_score
        ` : sql`1 - (embedding <=> ${embeddingString}::vector) as hybrid_score`}
      FROM cba_clauses
      ${whereClause ? sql`WHERE ${whereClause}` : sql``}
      ORDER BY ${hybridSearch.enabled ? sql`hybrid_score` : sql`similarity`} DESC
      LIMIT ${limit}
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (results as any[]).map((row: any) => ({
      id: row.id as string,
      content: row.content as string,
      similarity: hybridSearch.enabled ? (row.hybrid_score as number) : (row.similarity as number),
      metadata: {
        clauseNumber: row.clause_number,
        title: row.title,
        clauseType: row.clause_type,
        articleNumber: row.article_number,
        tags: row.tags,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })).filter((result: any) => result.similarity >= threshold);
  } catch (error) {
    logger.error('Error in semantic clause search', { error, query, options });
    throw new Error('Semantic search failed');
  }
}

/**
 * Find similar clauses to a given clause
 */
export async function findSimilarClauses(
  clauseId: string,
  options: {
    limit?: number;
    threshold?: number;
    sameTypeOnly?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const { limit = 5, threshold = 0.75, sameTypeOnly = false } = options;

  try {
    // Get the source clause
    const sourceClause = await db.query.cbaClause.findFirst({
      where: eq(cbaClause.id, clauseId),
    });

    if (!sourceClause) {
      throw new Error('Source clause not found');
    }

    // Get embedding for source clause
    const queryEmbedding = await generateEmbedding(sourceClause.content);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Build query with optional same-type filter
    const typeFilter = sameTypeOnly 
      ? sql`AND clause_type = ${sourceClause.clauseType}`
      : sql``;

    const results = await db.execute(sql`
      SELECT 
        id,
        clause_number,
        title,
        content,
        clause_type,
        cba_id,
        tags,
        1 - (embedding <=> ${embeddingString}::vector) as similarity
      FROM cba_clauses
      WHERE id != ${clauseId}
      ${typeFilter}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (results as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({
        id: row.id as string,
        content: row.content as string,
        similarity: row.similarity as number,
        metadata: {
          clauseNumber: row.clause_number,
          title: row.title,
          clauseType: row.clause_type,
          cbaId: row.cba_id,
          tags: row.tags,
        },
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((result: any) => result.similarity >= threshold);
  } catch (error) {
    logger.error('Error finding similar clauses', { error, clauseId, options });
    throw new Error('Failed to find similar clauses');
  }
}

/**
 * Semantic search for arbitration precedents
 */
export async function semanticPrecedentSearch(
  query: string,
  options: {
    limit?: number;
    threshold?: number;
    issueType?: string;
    jurisdiction?: string;
  } = {}
): Promise<SearchResult[]> {
  const { limit = 10, threshold = 0.7, issueType, jurisdiction } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    const whereFilters: SQL<unknown>[] = [];
    if (issueType) {
      whereFilters.push(sql`issue_type = ${issueType}`);
    }
    if (jurisdiction) {
      whereFilters.push(sql`tribunal_type = ${jurisdiction}`);
    }

    const whereClause = whereFilters.length > 0 
      ? sql`WHERE ${sql.join(whereFilters, sql` AND `)}`
      : sql``;

    const results = await db.execute(sql`
      SELECT 
        id,
        case_title,
        case_number,
        precedent_summary,
        reasoning,
        issue_type,
        outcome,
        precedent_value,
        citation_count,
        1 - (embedding <=> ${embeddingString}::vector) as similarity
      FROM arbitration_decisions
      ${whereClause}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (results as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({
        id: row.id as string,
        content: row.precedent_summary as string,
        similarity: row.similarity as number,
        metadata: {
          caseTitle: row.case_title,
          caseNumber: row.case_number,
          reasoning: row.reasoning,
          issueType: row.issue_type,
          outcome: row.outcome,
          precedentValue: row.precedent_value,
          citationCount: row.citation_count,
        },
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((result: any) => result.similarity >= threshold);
  } catch (error) {
    logger.error('Error in semantic precedent search', {
      error,
      query,
      options,
    });
    throw new Error('Semantic precedent search failed');
  }
}

/**
 * Batch generate and update embeddings for all clauses
 */
export async function generateClauseEmbeddings(
  options: {
    batchSize?: number;
    organizationId?: string;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ success: number; failed: number }> {
  const { batchSize = 100, organizationId, onProgress } = options;
  let success = 0;
  let failed = 0;

  try {
    // Get clauses without embeddings
    const whereClause = organizationId 
      ? and(
          eq(cbaClause.organizationId, organizationId),
          sql`embedding IS NULL`
        )
      : sql`embedding IS NULL`;

    const clauses = await db.query.cbaClause.findMany({
      where: whereClause,
      limit: 1000, // Process in chunks
    });

    const total = clauses.length;
    logger.info('Generating clause embeddings', { total });

    // Process in batches
    for (let i = 0; i < clauses.length; i += batchSize) {
      const batch = clauses.slice(i, i + batchSize);
      
      const embeddingPromises = batch.map(async clause => {
        try {
          const embedding = await generateEmbedding(
            `${clause.title} ${clause.content}`
          );
          
          await db.execute(sql`
            UPDATE cba_clauses
            SET embedding = ${`[${embedding.join(',')}]`}::vector
            WHERE id = ${clause.id}
          `);
          
          success++;
          return true;
        } catch (error) {
          logger.error('Failed to generate embedding for clause', {
            error,
            clauseId: clause.id,
          });
          failed++;
          return false;
        }
      });

      await Promise.all(embeddingPromises);
      
      if (onProgress) {
        onProgress(i + batch.length, total);
      }
    }

    logger.info('Clause embedding generation complete', { success, failed });
    return { success, failed };
  } catch (error) {
    logger.error('Error generating clause embeddings', { error });
    return { success, failed };
  }
}

/**
 * Batch generate embeddings for precedents
 */
export async function generatePrecedentEmbeddings(
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ success: number; failed: number }> {
  const { batchSize = 100, onProgress } = options;
  let success = 0;
  let failed = 0;

  try {
    const precedents = await db.query.arbitrationDecisions.findMany({
      where: sql`embedding IS NULL`,
      limit: 1000,
    });

    const total = precedents.length;
    logger.info('Generating precedent embeddings', { total });

    for (let i = 0; i < precedents.length; i += batchSize) {
      const batch = precedents.slice(i, i + batchSize);
      
      const embeddingPromises = batch.map(async precedent => {
        try {
          const textToEmbed = `${precedent.caseTitle} ${precedent.precedentSummary} ${precedent.reasoning}`;
          const embedding = await generateEmbedding(textToEmbed);
          
          await db.execute(sql`
            UPDATE arbitration_decisions
            SET embedding = ${`[${embedding.join(',')}]`}::vector
            WHERE id = ${precedent.id}
          `);
          
          success++;
          return true;
        } catch (error) {
          logger.error('Failed to generate embedding for precedent', {
            error,
            precedentId: precedent.id,
          });
          failed++;
          return false;
        }
      });

      await Promise.all(embeddingPromises);
      
      if (onProgress) {
        onProgress(i + batch.length, total);
      }
    }

    logger.info('Precedent embedding generation complete', { success, failed });
    return { success, failed };
  } catch (error) {
    logger.error('Error generating precedent embeddings', { error });
    return { success, failed };
  }
}

/**
 * Multi-modal search: combine clause search with precedent search
 */
export async function unifiedSemanticSearch(
  query: string,
  options: {
    includeClauses?: boolean;
    includePrecedents?: boolean;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<{
  clauses: SearchResult[];
  precedents: SearchResult[];
  combined: SearchResult[];
}> {
  const {
    includeClauses = true,
    includePrecedents = true,
    limit = 10,
    threshold = 0.7,
  } = options;

  const [clauses, precedents] = await Promise.all([
    includeClauses ? semanticClauseSearch(query, { limit, threshold }) : [],
    includePrecedents ? semanticPrecedentSearch(query, { limit, threshold }) : [],
  ]);

  // Combine and sort by similarity
  const combined = [...clauses, ...precedents]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return {
    clauses,
    precedents,
    combined,
  };
}

