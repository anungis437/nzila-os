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

import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import type { ExitInterviewSensitivityLevel } from '@/db/schema';

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  roleInUnion: string;
  yearsOfService: number;
  summary: string | null;
  sensitivityLevel: ExitInterviewSensitivityLevel;
  expertiseTags: string[] | null;
  topics: string[] | null;
  publishedAt: string | null;
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
  limit?: number;
  /** Weight for semantic score vs keyword score. Default: 0.6 */
  semanticWeight?: number;
}

async function generateQueryEmbedding(query: string): Promise<number[] | null> {
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
 * Always org-scoped and sensitivity-filtered.
 */
async function keywordSearch(
  query: string,
  orgId: string,
  allowedSensitivityLevels: ExitInterviewSensitivityLevel[],
  limit: number,
): Promise<KnowledgeSearchResult[]> {
  const pattern = `%${query}%`;
  const rows = await db
    .select({
      id: exitInterviews.id,
      title: exitInterviews.title,
      roleInUnion: exitInterviews.roleInUnion,
      yearsOfService: exitInterviews.yearsOfService,
      summary: exitInterviews.summary,
      sensitivityLevel: exitInterviews.sensitivityLevel,
      expertiseTags: exitInterviews.expertiseTags,
      topics: exitInterviews.topics,
      publishedAt: exitInterviews.publishedAt,
    })
    .from(exitInterviews)
    .where(
      and(
        eq(exitInterviews.organizationId, orgId),
        eq(exitInterviews.status, 'published'),
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
    .filter((r) => allowedSensitivityLevels.includes(r.sensitivityLevel as ExitInterviewSensitivityLevel))
    .map((r) => ({
      id: r.id,
      title: r.title,
      roleInUnion: r.roleInUnion,
      yearsOfService: r.yearsOfService,
      summary: r.summary,
      sensitivityLevel: r.sensitivityLevel as ExitInterviewSensitivityLevel,
      expertiseTags: r.expertiseTags as string[] | null,
      topics: r.topics as string[] | null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      keywordScore: 1,
      semanticScore: null,
      relevanceScore: 1,
      sourceInterviewId: r.id,
    }));
}

/**
 * Semantic vector search against the knowledge_base table.
 * Only retrieves exit_interview source records.
 */
async function semanticSearch(
  embedding: number[],
  orgId: string,
  allowedSensitivityLevels: ExitInterviewSensitivityLevel[],
  limit: number,
): Promise<Map<string, number>> {
  // pgvector cosine distance; lower is more similar
  const embeddingLiteral = `'[${embedding.join(',')}]'::vector`;
  const rows = await db.execute(
    sql`
      SELECT kb.source_id, 1 - (kb.embedding <=> ${sql.raw(embeddingLiteral)}) AS similarity
      FROM knowledge_base kb
      INNER JOIN exit_interviews ei ON ei.id::text = kb.source_id
      WHERE kb.organization_id = ${orgId}
        AND kb.source_type = 'exit_interview'
        AND kb.is_active = true
        AND ei.status = 'published'
        AND ei.sensitivity_level = ANY(${allowedSensitivityLevels}::text[])
        AND kb.embedding IS NOT NULL
      ORDER BY kb.embedding <=> ${sql.raw(embeddingLiteral)}
      LIMIT ${limit}
    `,
  );

  const scoreMap = new Map<string, number>();
  for (const row of rows as unknown as Array<{ source_id: string; similarity: number }>) {
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

  const [keywordResults, queryEmbedding] = await Promise.all([
    keywordSearch(query, orgId, allowedSensitivityLevels, limit * 2),
    generateQueryEmbedding(query),
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
          sensitivityLevel: exitInterviews.sensitivityLevel,
          expertiseTags: exitInterviews.expertiseTags,
          topics: exitInterviews.topics,
          publishedAt: exitInterviews.publishedAt,
        })
        .from(exitInterviews)
        .where(
          and(
            eq(exitInterviews.organizationId, orgId),
            eq(exitInterviews.status, 'published'),
            sql`${exitInterviews.id} = ANY(${semanticOnlyIds}::uuid[])`,
          ),
        );

      for (const r of semanticRows) {
        if (!allowedSensitivityLevels.includes(r.sensitivityLevel as ExitInterviewSensitivityLevel)) continue;
        const semScore = semanticScores.get(r.id) ?? 0;
        resultMap.set(r.id, {
          id: r.id,
          title: r.title,
          roleInUnion: r.roleInUnion,
          yearsOfService: r.yearsOfService,
          summary: r.summary,
          sensitivityLevel: r.sensitivityLevel as ExitInterviewSensitivityLevel,
          expertiseTags: r.expertiseTags as string[] | null,
          topics: r.topics as string[] | null,
          publishedAt: r.publishedAt?.toISOString() ?? null,
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
