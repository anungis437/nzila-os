/**
 * /api/ai/search — AI-powered knowledge base search
 *
 * POST: Semantic search over the knowledge_base table using pgvector
 *       embeddings + optional keyword matching + optional AI-generated answer.
 * GET:  Returns index health / stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/services/ai/vector-search-service';
import { getAiClient, UE_APP_KEY, UE_SYSTEM_ORG_ID, UE_PROFILES } from '@/lib/ai/ai-client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  max_results: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.6),
  document_type: z.enum([
    'collective_agreement', 'union_policy', 'labor_law',
    'precedent', 'faq', 'guide', 'other',
  ]).optional(),
  generate_answer: z.boolean().default(false),
});

export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  // Rate limit
  const rateLimitResult = await checkRateLimit(
    `ai-completion:${context.userId}`,
    RATE_LIMITS.AI_COMPLETION,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for AI operations. Please try again later.' },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) },
    );
  }

  // Entitlement
  const entitlement = await checkEntitlement(context.organizationId as string, 'ai_search');
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason, upgradeUrl: entitlement.upgradeUrl, feature: 'ai_search' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const validation = searchSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid search request',
        validation.error.errors,
      );
    }

    const { query, max_results, threshold, document_type, generate_answer } = validation.data;
    const orgId = context.organizationId as string;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build optional type filter
    const typeFilter = document_type
      ? sql`AND document_type = ${document_type}`
      : sql``;

    // Semantic search with org-scoping + visibility rules
    const results = await db.execute(sql`
      SELECT
        id,
        title,
        document_type,
        content,
        summary,
        tags,
        keywords,
        language,
        source_type,
        source_url,
        view_count,
        citation_count,
        effective_date,
        expiry_date,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM knowledge_base
      WHERE is_active = true
        AND (organization_id = ${orgId} OR is_public = true)
        AND (expiry_date IS NULL OR expiry_date > now())
        AND embedding IS NOT NULL
        ${typeFilter}
      ORDER BY similarity DESC
      LIMIT ${max_results}
    `);

    const hits = (results as unknown as Array<Record<string, unknown>>)
      .filter((r) => (r.similarity as number) >= threshold)
      .map((r) => ({
        id: r.id,
        title: r.title,
        document_type: r.document_type,
        summary: r.summary,
        content_preview: (r.content as string).slice(0, 300),
        tags: r.tags,
        keywords: r.keywords,
        language: r.language,
        source_type: r.source_type,
        source_url: r.source_url,
        similarity: Number((r.similarity as number).toFixed(4)),
        view_count: r.view_count,
        citation_count: r.citation_count,
        effective_date: r.effective_date,
        expiry_date: r.expiry_date,
      }));

    // Optionally generate an AI answer grounded on the retrieved docs
    let answer: string | undefined;
    if (generate_answer && hits.length > 0) {
      try {
        const contextText = hits
          .map((h, i) => `[${i + 1}] ${h.title}\n${h.content_preview}`)
          .join('\n\n');

        const ai = getAiClient();
        const gen = await ai.generate({
          orgId: UE_SYSTEM_ORG_ID,
          appKey: UE_APP_KEY,
          profileKey: UE_PROFILES.CHATBOT,
          input: `Answer the following question based ONLY on the provided context documents. If the documents don't contain enough information, say so.\n\nQuestion: ${query}\n\nContext:\n${contextText}`,
          dataClass: 'internal',
          params: { temperature: 0.3, maxTokens: 500 },
        });
        answer = gen.content;
      } catch (err) {
        logger.warn('AI answer generation failed, returning search results only', { error: err });
      }
    }

    return NextResponse.json({
      query,
      results: hits,
      count: hits.length,
      ...(answer ? { answer } : {}),
    });
  } catch (error) {
    logger.error('Knowledge base search failed', { error });
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
});

export const GET = withRoleAuth('member', async (_request: NextRequest, _context: BaseAuthContext) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE embedding IS NOT NULL)::int AS with_embeddings,
        count(DISTINCT organization_id)::int AS organizations,
        count(DISTINCT document_type)::int AS document_types
      FROM knowledge_base
      WHERE is_active = true
    `);

    const stats = (rows as unknown as Array<Record<string, unknown>>)[0] || {};
    const total = (stats.total as number) || 0;
    const withEmbeddings = (stats.with_embeddings as number) || 0;

    return NextResponse.json({
      status: withEmbeddings > 0 ? 'ready' : 'pending',
      knowledge_base: {
        total,
        with_embeddings: withEmbeddings,
        percentage: total > 0 ? Math.round((withEmbeddings / total) * 100) : 0,
        organizations: stats.organizations,
        document_types: stats.document_types,
      },
    });
  } catch (error) {
    logger.error('Knowledge base stats failed', { error });
    return NextResponse.json({ error: 'Failed to retrieve stats' }, { status: 500 });
  }
});
