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

import {
  getAiClient,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
import { cbaClause } from '@/db/schema';
import { eq, sql, and, or, SQL } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import { embeddingCache } from './embedding-cache';
import { CLAUSE_EMBEDDING, PRECEDENT_EMBEDDING, requireVectorColumn } from '@/lib/ai/vector-readiness';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const _EMBEDDING_DIMENSIONS = 1536;

type SqlRow = Record<string, unknown>;

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
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
export async function generateEmbedding(
  text: string,
  _organizationId?: string,
): Promise<number[]> {
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
      orgId: UE_SYSTEM_ORG_ID,
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

  // Clauses belong to an organization: a search that does not say whose clauses to search reads none
  const organizationId = filters.organizationId;
  if (!organizationId) {
    throw new Error('organizationId is required to search clauses');
  }

  // Asked before the query is sent to the embedding service: a database that cannot search by similarity cannot use the answer.
  await requireVectorColumn(CLAUSE_EMBEDDING);

  try {
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query, organizationId);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Build WHERE clause based on filters
    const whereConditions: (SQL | undefined)[] = [];
    if (filters.clauseType && filters.clauseType.length > 0) {
      whereConditions.push(
        or(...filters.clauseType.map(type => eq(cbaClause.clauseType, type as (typeof cbaClause.clauseType)['_']['data'])))
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Perform vector similarity search using pgvector, in the organization's own context after the embedding call has returned.
    // A clause's tags are its key terms (cba_clauses has no tags column).
    const results = await withRLSContext({ organizationId }, (tx) => tx.execute(sql`
      SELECT 
        id,
        clause_number,
        title,
        content,
        clause_type,
        article_number,
        key_terms AS tags,
        1 - (embedding <=> ${embeddingString}::vector) as similarity,
        ${hybridSearch.enabled ? sql`
          (1 - (embedding <=> ${embeddingString}::vector)) * ${1 - (hybridSearch.keywordWeight || 0.3)} +
          (CASE WHEN content ILIKE ${`%${query}%`} THEN ${hybridSearch.keywordWeight || 0.3} ELSE 0 END) as hybrid_score
        ` : sql`1 - (embedding <=> ${embeddingString}::vector) as hybrid_score`}
      FROM cba_clauses
      WHERE organization_id = ${organizationId}
      ${whereClause ? sql`AND ${whereClause}` : sql``}
      ORDER BY ${hybridSearch.enabled ? sql`hybrid_score` : sql`similarity`} DESC
      LIMIT ${limit}
    `));

    return (results as unknown as SqlRow[]).map((row: SqlRow) => ({
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
    })).filter((result) => result.similarity >= threshold);
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
    organizationId: string;
    limit?: number;
    threshold?: number;
    sameTypeOnly?: boolean;
  }
): Promise<SearchResult[]> {
  const { organizationId, limit = 5, threshold = 0.75, sameTypeOnly = false } = options;

  await requireVectorColumn(CLAUSE_EMBEDDING);

  try {
    // Get the source clause, in the organization's own context; one in another organization is simply not found
    const sourceClause = await withRLSContext({ organizationId }, (tx) =>
      tx.query.cbaClause.findFirst({
        where: and(eq(cbaClause.id, clauseId), eq(cbaClause.organizationId, organizationId)),
      }),
    );

    if (!sourceClause) {
      throw new Error('Source clause not found');
    }

    // Get embedding for source clause
    const queryEmbedding = await generateEmbedding(sourceClause.content, sourceClause.organizationId);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Build query with optional same-type filter
    const typeFilter = sameTypeOnly 
      ? sql`AND clause_type = ${sourceClause.clauseType}`
      : sql``;

    const results = await withRLSContext({ organizationId }, (tx) => tx.execute(sql`
      SELECT 
        id,
        clause_number,
        title,
        content,
        clause_type,
        cba_id,
        key_terms AS tags,
        1 - (embedding <=> ${embeddingString}::vector) as similarity
      FROM cba_clauses
      WHERE id != ${clauseId}
        AND organization_id = ${organizationId}
      ${typeFilter}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `));

    return (results as unknown as SqlRow[])
      .map((row: SqlRow) => ({
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
      .filter((result) => result.similarity >= threshold);
  } catch (error) {
    logger.error('Error finding similar clauses', { error, clauseId, options });
    throw new Error('Failed to find similar clauses');
  }
}

/**
 * Semantic search for arbitration precedents. The decisions a caller may see (public ones and its own) are decided by row-level security in the
 * organization's own context, so the search says whose context to run in.
 */
export async function semanticPrecedentSearch(
  query: string,
  options: {
    organizationId: string;
    limit?: number;
    threshold?: number;
    issueType?: string;
    jurisdiction?: string;
  }
): Promise<SearchResult[]> {
  const { organizationId, limit = 10, threshold = 0.7, issueType, jurisdiction } = options;
  if (!organizationId) {
    throw new Error('organizationId is required to search precedents');
  }

  await requireVectorColumn(PRECEDENT_EMBEDDING);

  try {
    const queryEmbedding = await generateEmbedding(query);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // issue_types is a jsonb array of the issues a decision turned on; jurisdiction is its own column
    const whereFilters: SQL[] = [];
    if (issueType) {
      whereFilters.push(sql`issue_types @> to_jsonb(${issueType}::text)`);
    }
    if (jurisdiction) {
      whereFilters.push(sql`jurisdiction = ${jurisdiction}`);
    }

    const whereClause = whereFilters.length > 0 
      ? sql`WHERE ${sql.join(whereFilters, sql` AND `)}`
      : sql``;

    const results = await withRLSContext({ organizationId }, (tx) => tx.execute(sql`
      SELECT 
        id,
        case_title,
        case_number,
        precedent_summary,
        reasoning,
        issue_types,
        outcome,
        precedent_value,
        citation_count,
        1 - (embedding <=> ${embeddingString}::vector) as similarity
      FROM arbitration_decisions
      ${whereClause}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `));

    return (results as unknown as SqlRow[])
      .map((row: SqlRow) => ({
        id: row.id as string,
        content: row.precedent_summary as string,
        similarity: row.similarity as number,
        metadata: {
          caseTitle: row.case_title,
          caseNumber: row.case_number,
          reasoning: row.reasoning,
          issueTypes: row.issue_types,
          outcome: row.outcome,
          precedentValue: row.precedent_value,
          citationCount: row.citation_count,
        },
      }))
      .filter((result) => result.similarity >= threshold);
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
 * Multi-modal search: combine clause search with precedent search
 */
export async function unifiedSemanticSearch(
  query: string,
  options: {
    organizationId: string;
    includeClauses?: boolean;
    includePrecedents?: boolean;
    limit?: number;
    threshold?: number;
  }
): Promise<{
  clauses: SearchResult[];
  precedents: SearchResult[];
  combined: SearchResult[];
}> {
  const {
    organizationId,
    includeClauses = true,
    includePrecedents = true,
    limit = 10,
    threshold = 0.7,
  } = options;

  // One after the other: each search opens its own organization context, and two contexts must not interleave on one connection when this runs inside a transaction.
  const clauses = includeClauses ? await semanticClauseSearch(query, { limit, threshold, filters: { organizationId } }) : [];
  const precedents = includePrecedents ? await semanticPrecedentSearch(query, { organizationId, limit, threshold }) : [];

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

