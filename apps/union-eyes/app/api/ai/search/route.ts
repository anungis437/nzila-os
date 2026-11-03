/**
 * /api/ai/search — AI-powered knowledge base search
 *
 * POST: Semantic search over the knowledge_base table using pgvector
 *       embeddings + optional keyword matching + optional AI-generated answer.
 * GET:  Returns index health / stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, hasMinRole, BaseAuthContext } from '@/lib/api-auth-guard';
import { knowledgeBaseSourceCondition, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { buildCanonicalAiOutput } from '@nzila/ai-sdk';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/services/ai/vector-search-service';
import { searchKnowledgeBaseByEmbedding } from '@/lib/ai/knowledge-base-embeddings';
import { KNOWLEDGE_BASE_EMBEDDING, VectorSearchUnavailableError, vectorColumnReady } from '@/lib/ai/vector-readiness';
import { buildOrgAiTrace, toGatewayDataClass, getAiClient, UE_APP_KEY, UE_SYSTEM_ORG_ID, UE_PROFILES } from '@/lib/ai/ai-client';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

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

    // OWASP AI: Feature flag + AI safety gate
    const blocked = await guardAiFeature(AI_FEATURES.AI_SEARCH, { userId: context.userId, organizationId: context.organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'search', action: 'POST', organizationId: context.organizationId, userId: context.userId, userRole: 'member', dataClass: 'internal' });

  try {
    const body = await request.json();
    const validation = searchSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid search request',
        validation.error.issues,
      );
    }

    const { query, max_results, threshold, document_type, generate_answer } = validation.data;
    const orgId = context.organizationId as string;

    // pgvector is optional: without it the query would be sent to the embedding service and then fail. Ask first, and answer that it is not available (501).
    if (!(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING))) {
      return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, new VectorSearchUnavailableError(KNOWLEDGE_BASE_EMBEDDING).message);
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // A knowledge asset made from an exit interview keeps that interview's sensitivity and consent: it is returned only to a caller who holds the
    // role that sensitivity requires, and only while the retiree's consent stands (the rule the knowledge list applies).
    const reader = await resolveInterviewReader(context.userId ?? null, false, hasMinRole);

    // The database scores the matches and applies the organization, expiry, visibility, type and threshold, then orders and limits them.
    const matches = await withRLSContext(async (tx) =>
      searchKnowledgeBaseByEmbedding(tx, {
        organizationId: orgId,
        embedding: queryEmbedding,
        minSimilarity: threshold,
        limit: max_results,
        documentTypes: document_type ? [document_type] : undefined,
        sourceCondition: knowledgeBaseSourceCondition(reader, orgId),
      }),
    );

    const hits = matches.map((r) => ({
      id: r.id,
      title: r.title,
      document_type: r.documentType,
      summary: r.summary,
      content_preview: r.content.slice(0, 300),
      tags: r.tags,
      keywords: r.keywords,
      language: r.language,
      source_type: r.sourceType,
      source_url: r.sourceUrl,
      similarity: Number(r.similarity.toFixed(4)),
      view_count: r.viewCount,
      citation_count: r.citationCount,
      effective_date: r.effectiveDate,
      expiry_date: r.expiryDate,
    }));

    // Optionally generate an AI answer grounded on the retrieved docs
    let answer: string | undefined;
    if (generate_answer && hits.length > 0) {
      try {
        const contextText = hits
          .map((h, i) => `[${i + 1}] ${h.title}\n${h.content_preview}`)
          .join('\n\n');

        const ai = getAiClient();
        const gen = await performAuditedOperation({
      organizationId: orgId,
      userId: context.userId,
      action: 'ai.search-answer.generate',
      resourceType: 'ai_invocations',
      
    }, () => ai.generate({
          orgId: UE_SYSTEM_ORG_ID,
          trace: buildOrgAiTrace(orgId),
          appKey: UE_APP_KEY,
          profileKey: UE_PROFILES.CHATBOT,
          input: `Answer the following question based ONLY on the provided context documents. If the documents don't contain enough information, say so.\n\nQuestion: ${query}\n\nContext:\n${contextText}`,
          dataClass: toGatewayDataClass('confidential'),
          params: { temperature: 0.3, maxTokens: 500 },
        }));
        answer = gen.content;
      } catch (err) {
        logger.warn('AI answer generation failed, returning search results only', { error: err });
      }
    }

    if (answer) {
      return NextResponse.json(buildCanonicalAiOutput({
        payload: {
          query,
          results: hits,
          count: hits.length,
          answer,
        },
        appKey: UE_APP_KEY,
        orgId,
        execution: {
          requestId: 'search-answer',
          traceId: 'search-answer',
          modelUsed: 'ue-chatbot',
          engineVersion: 'ai:ue-chatbot',
        },
        confidenceScore: hits.length > 0 ? Math.min(0.95, 0.5 + (hits[0]?.similarity ?? 0) / 2) : 0.5,
        evidenceRefs: hits.map((hit) => `knowledge_base:${hit.id}`),
        reviewRequired: true,
        domain: 'labour',
      }));
    }

    return NextResponse.json({
      query,
      results: hits,
      count: hits.length,
    });
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    logger.error('Knowledge base search failed', { error });
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
});

export const GET = withRoleAuth('member', async (_request: NextRequest, _context: BaseAuthContext) => {
  if (!_context.organizationId) {
    return NextResponse.json({ error: 'No active organization' }, { status: 400 });
  }
  const statsOrgId = _context.organizationId;
  // OWASP AI: Feature flag gate for knowledge base stats
  const getBlocked = await guardAiFeature(AI_FEATURES.AI_SEARCH, { userId: _context.userId, organizationId: _context.organizationId });
  if (getBlocked) return getBlocked;

  try {
    // Without pgvector there is no embedding column to count: the index is unavailable, not empty.
    const vectorReady = await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING);
    const rows = await withRLSContext(async () => db.execute(vectorReady ? sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE embedding IS NOT NULL)::int AS with_embeddings,
        count(DISTINCT organization_id)::int AS organizations,
        count(DISTINCT document_type)::int AS document_types
      FROM knowledge_base
      WHERE is_active = true
        AND organization_id = ${statsOrgId}
    ` : sql`
      SELECT
        count(*)::int AS total,
        0::int AS with_embeddings,
        count(DISTINCT organization_id)::int AS organizations,
        count(DISTINCT document_type)::int AS document_types
      FROM knowledge_base
      WHERE is_active = true
        AND organization_id = ${statsOrgId}
    `));

    const stats = (rows as any as Array<Record<string, unknown>>)[0] || {};
    const total = (stats.total as number) || 0;
    const withEmbeddings = (stats.with_embeddings as number) || 0;

    return NextResponse.json({
      status: !vectorReady ? 'unavailable' : withEmbeddings > 0 ? 'ready' : 'pending',
      ...(vectorReady ? {} : { reason: new VectorSearchUnavailableError(KNOWLEDGE_BASE_EMBEDDING).message }),
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
