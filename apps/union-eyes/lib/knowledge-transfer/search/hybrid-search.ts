/**
 * Hybrid Knowledge Search
 *
 * Combines keyword full-text search with pgvector semantic retrieval for
 * governance-aware, org-scoped knowledge retrieval across exit interviews.
 *
 * Ranking: semantic similarity score weighted against keyword relevance.
 * Governance: sensitivity level controls which results are included based
 * on the caller's resolved role level.
 */

import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { sqlIn } from '@/lib/db/sql-in';
import { exitInterviews } from '@/db/schema';
import {
  getAiClient,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import { KNOWLEDGE_BASE_EMBEDDING, vectorColumnReady } from '@/lib/ai/vector-readiness';
import { interviewListCondition, type InterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import type { ExitInterviewIndexingStatus, ExitInterviewSensitivityLevel } from '@/db/schema';

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  roleInUnion: string;
  yearsOfService: number;
  summary: string | null;
  /** The operational summary written for the interview (the summarize route); null until one is. Read with the interview, so it is the caller's to read exactly when the interview is. */
  aiSummary: string | null;
  sensitivityLevel: ExitInterviewSensitivityLevel;
  expertiseTags: string[] | null;
  topics: string[] | null;
  publishedAt: string | null;
  /** Whether the interview has been indexed for semantic search. */
  indexingStatus: ExitInterviewIndexingStatus;
  /** Keyword match score (1 = matched, 0 = not) */
  keywordScore: number;
  /** Cosine similarity from vector search (null if no embedding available) */
  semanticScore: number | null;
  /** Combined relevance score (0–1) */
  relevanceScore: number;
  /** Source interview ID for lineage */
  sourceInterviewId: string;
}

export interface HybridSearchOptions {
  query: string;
  orgId: string;
  /** Allowed sensitivity levels based on caller's role */
  allowedSensitivityLevels: ExitInterviewSensitivityLevel[];
  /**
   * Whether the caller holds the steward role or above. A published interview is shared with the organization only with the retiring
   * employee's consent; a steward or above reads it without. Omitted means below steward: consent is required.
   */
  stewardPlus?: boolean;
  limit?: number;
  /** Weight for semantic score vs keyword score. Default: 0.6 */
  semanticWeight?: number;
}

async function generateQueryEmbedding(
  query: string,
  _orgId?: string,
): Promise<number[] | null> {
  try {
    const cached = await embeddingCache.getCachedEmbedding(query, 'ai-sdk');
    if (cached) return cached;

    const ai = getAiClient();
    const result = await ai.embed({
      orgId: UE_SYSTEM_ORG_ID,
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.EMBEDDINGS,
      input: query,
      dataClass: 'internal',
    });
    const embedding = result.embeddings[0];
    embeddingCache.setCachedEmbedding(query, 'ai-sdk', embedding).catch(() => {});
    return embedding;
  } catch {
    return null;
  }
}

/**
 * Keyword-based search across published exit interviews.
 * Always org-scoped, sensitivity-filtered and consent-filtered.
 */
async function keywordSearch(
  query: string,
  orgId: string,
  reader: InterviewReader,
  limit: number,
): Promise<KnowledgeSearchResult[]> {
  // LIKE wildcards typed in the query are literal characters, not a pattern the caller controls.
  const pattern = `%${query.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  if (reader.levels.size === 0) return [];
  const rows = await db
    .select({
      id: exitInterviews.id,
      title: exitInterviews.title,
      roleInUnion: exitInterviews.roleInUnion,
      yearsOfService: exitInterviews.yearsOfService,
      summary: exitInterviews.summary,
      aiSummary: exitInterviews.aiSummary,
      sensitivityLevel: exitInterviews.sensitivityLevel,
      expertiseTags: exitInterviews.expertiseTags,
      topics: exitInterviews.topics,
      publishedAt: exitInterviews.publishedAt,
      indexingStatus: exitInterviews.indexingStatus,
    })
    .from(exitInterviews)
    .where(
      and(
        eq(exitInterviews.organizationId, orgId),
        eq(exitInterviews.status, 'published'),
        // The sensitivity floor and the retiree's consent are part of the query, so the limit counts only interviews the caller may read.
        interviewListCondition(reader),
        or(
          ilike(exitInterviews.title, pattern),
          ilike(exitInterviews.keyLessons, pattern),
          ilike(exitInterviews.bestPractices, pattern),
          ilike(exitInterviews.bargainingAdvice, pattern),
          ilike(exitInterviews.mediationAdvice, pattern),
          ilike(exitInterviews.incomingOfficerAdvice, pattern),
          ilike(exitInterviews.aiSummary, pattern),
        ),
      ),
    )
    .limit(limit);

  return rows
    .filter((r) => reader.levels.has(r.sensitivityLevel))
    .map((r) => ({
      id: r.id,
      title: r.title,
      roleInUnion: r.roleInUnion,
      yearsOfService: r.yearsOfService,
      summary: r.summary,
      aiSummary: r.aiSummary,
      sensitivityLevel: r.sensitivityLevel as ExitInterviewSensitivityLevel,
      expertiseTags: r.expertiseTags as string[] | null,
      topics: r.topics as string[] | null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      indexingStatus: r.indexingStatus,
      keywordScore: 1,
      semanticScore: null,
      relevanceScore: 1,
      sourceInterviewId: r.id,
    }));
}

/**
 * Semantic vector search against the knowledge_base table.
 * Only retrieves exit_interview source records, and only while the retiree's consent stands (the knowledge copy follows the interview).
 */
async function semanticSearch(
  embedding: number[],
  orgId: string,
  allowedSensitivityLevels: ExitInterviewSensitivityLevel[],
  limit: number,
): Promise<Map<string, number>> {
  // pgvector cosine distance; lower is more similar. The vector is a bound parameter: what the embedding service returned is never part of the statement text.
  const vector = `[${embedding.map((value) => Number(value)).join(',')}]`;
  const rows = await db.execute(
    sql`
      SELECT kb.source_id, 1 - (kb.embedding <=> ${vector}::vector) AS similarity
      FROM knowledge_base kb
      INNER JOIN exit_interviews ei ON ei.id::text = kb.source_id
      WHERE kb.organization_id = ${orgId}
        AND kb.source_type = 'exit_interview'
        AND kb.is_active = true
        AND ei.status = 'published'
        AND ei.consent_granted = true
        AND ${sqlIn(sql`ei.sensitivity_level`, allowedSensitivityLevels)}
        AND kb.embedding IS NOT NULL
      ORDER BY kb.embedding <=> ${vector}::vector
      LIMIT ${limit}
    `,
  );

  const scoreMap = new Map<string, number>();
  for (const row of rows as any as Array<{ source_id: string; similarity: number }>) {
    scoreMap.set(row.source_id, row.similarity);
  }
  return scoreMap;
}

/**
 * Perform hybrid semantic + keyword search over published exit interviews.
 */
export async function hybridKnowledgeSearch(
  options: HybridSearchOptions,
): Promise<KnowledgeSearchResult[]> {
  const { query, orgId, allowedSensitivityLevels, limit = 10, semanticWeight = 0.6 } = options;
  // Search results are the shared knowledge, not the caller's own interviews: no author branch, only the levels and the consent rule.
  const reader: InterviewReader = { userId: null, stewardPlus: options.stewardPlus ?? false, levels: new Set(allowedSensitivityLevels) };

  // pgvector is optional. Without it there is nothing to rank by similarity: the query is not sent to the embedding service and the search is the keyword search.
  const semanticAvailable = await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING);

  const [keywordResults, queryEmbedding] = await Promise.all([
    keywordSearch(query, orgId, reader, limit * 2),
    semanticAvailable ? generateQueryEmbedding(query, orgId) : Promise.resolve(null),
  ]);

  let semanticScores = new Map<string, number>();
  if (queryEmbedding) {
    semanticScores = await semanticSearch(queryEmbedding, orgId, allowedSensitivityLevels, limit * 2);
  }

  // Build unified result map
  const resultMap = new Map<string, KnowledgeSearchResult>();

  for (const r of keywordResults) {
    const semScore = semanticScores.get(r.id) ?? 0;
    const combined = keywordWeight(1, semScore, semanticWeight);
    resultMap.set(r.id, { ...r, semanticScore: semScore || null, relevanceScore: combined });
  }

  // Add semantic-only results (not in keyword results)
  if (semanticScores.size > 0) {
    const semanticOnlyIds = [...semanticScores.keys()].filter((id) => !resultMap.has(id));
    if (semanticOnlyIds.length > 0) {
      const semanticRows = await db
        .select({
          id: exitInterviews.id,
          title: exitInterviews.title,
          roleInUnion: exitInterviews.roleInUnion,
          yearsOfService: exitInterviews.yearsOfService,
          summary: exitInterviews.summary,
          aiSummary: exitInterviews.aiSummary,
          sensitivityLevel: exitInterviews.sensitivityLevel,
          expertiseTags: exitInterviews.expertiseTags,
          topics: exitInterviews.topics,
          publishedAt: exitInterviews.publishedAt,
          indexingStatus: exitInterviews.indexingStatus,
        })
        .from(exitInterviews)
        .where(
          and(
            eq(exitInterviews.organizationId, orgId),
            eq(exitInterviews.status, 'published'),
            interviewListCondition(reader),
            inArray(exitInterviews.id, semanticOnlyIds),
          ),
        );

      for (const r of semanticRows) {
        if (!reader.levels.has(r.sensitivityLevel)) continue;
        const semScore = semanticScores.get(r.id) ?? 0;
        resultMap.set(r.id, {
          id: r.id,
          title: r.title,
          roleInUnion: r.roleInUnion,
          yearsOfService: r.yearsOfService,
          summary: r.summary,
          aiSummary: r.aiSummary,
          sensitivityLevel: r.sensitivityLevel as ExitInterviewSensitivityLevel,
          expertiseTags: r.expertiseTags as string[] | null,
          topics: r.topics as string[] | null,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          indexingStatus: r.indexingStatus,
          keywordScore: 0,
          semanticScore: semScore,
          relevanceScore: keywordWeight(0, semScore, semanticWeight),
          sourceInterviewId: r.id,
        });
      }
    }
  }

  return [...resultMap.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

function keywordWeight(kwScore: number, semScore: number, semWeight: number): number {
  return semScore * semWeight + kwScore * (1 - semWeight);
}
