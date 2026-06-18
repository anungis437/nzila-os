/**
 * /api/ai/summarize — AI text summarization
 *
 * POST: Summarize arbitrary text (or a knowledge-base document by ID)
 *       using the centralized AI SDK.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { buildCanonicalAiOutput } from '@nzila/ai-sdk';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildOrgAiTrace, getAiClient, UE_APP_KEY, UE_SYSTEM_ORG_ID, UE_PROFILES } from '@/lib/ai/ai-client';
import { logger } from '@/lib/logger';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

export const dynamic = 'force-dynamic';

const summarizeSchema = z.object({
  content: z.string().min(1).max(50_000).optional(),
  document_id: z.string().uuid().optional(),
  type: z.enum(['brief', 'detailed']).default('brief'),
  max_length: z.number().int().min(50).max(2000).default(300),
}).refine(
  (d) => d.content || d.document_id,
  { message: 'Either content or document_id is required' },
);

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
      { error: entitlement.reason, upgradeUrl: entitlement.upgradeUrl, feature: 'ai_summarize' },
      { status: 403 },
    );
  }

    // OWASP AI: Feature flag + AI safety gate
    const blocked = await guardAiFeature(AI_FEATURES.AI_SUMMARIZE, { userId: context.userId, organizationId: context.organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'summarize', action: 'POST', organizationId: context.organizationId, userId: context.userId, userRole: 'member', dataClass: 'internal' });

  try {
    const body = await request.json();
    const validation = summarizeSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid summarize request',
        validation.error.errors,
      );
    }

    const { content, document_id, type, max_length } = validation.data;
    const orgId = context.organizationId as string;

    // Resolve text to summarize
    let textToSummarize = content;
    let documentTitle: string | undefined;

    if (document_id) {
      const doc = await db.query.knowledgeBase.findFirst({
        where: and(
          eq(knowledgeBase.id, document_id),
          eq(knowledgeBase.isActive, true),
        ),
        columns: { content: true, title: true, organizationId: true, isPublic: true },
      });

      if (!doc) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
      }
      if (doc.organizationId !== orgId && !doc.isPublic) {
        return standardErrorResponse(ErrorCode.FORBIDDEN, 'Access denied to this document');
      }

      textToSummarize = doc.content;
      documentTitle = doc.title;
    }

    if (!textToSummarize) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'No content to summarize');
    }

    const systemPrompt = type === 'detailed'
      ? `You are an expert labor-relations analyst. Produce a structured summary of the following document. Include key provisions, obligations, timelines, and any notable exceptions. Limit your response to approximately ${max_length} characters.`
      : `Summarize the following text concisely in approximately ${max_length} characters. Focus on the most important points.`;

    const ai = getAiClient();
    const result = await ai.generate({
      orgId: UE_SYSTEM_ORG_ID,
      trace: buildOrgAiTrace(orgId),
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CLAUSE_SUMMARY,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textToSummarize },
      ],
      dataClass: 'internal',
      params: { temperature: 0.3, maxTokens: Math.min(max_length, 2000) },
    });

    return NextResponse.json(buildCanonicalAiOutput({
      payload: {
        summary: result.content,
        type,
        ...(documentTitle ? { document_title: documentTitle } : {}),
        ...(document_id ? { document_id } : {}),
        tokens_used: result.tokensIn + result.tokensOut,
        model: result.model,
        latency_ms: result.latencyMs,
      },
      appKey: UE_APP_KEY,
      orgId,
      execution: {
        requestId: result.requestId,
        traceId: result.requestId,
        modelUsed: result.model,
        provider: result.provider,
        engineVersion: `${result.provider}:${result.model}`,
        latencyMs: result.latencyMs,
        tokenCostUsd: result.costUsd,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      },
      confidenceScore: type === 'detailed' ? 0.76 : 0.72,
      evidenceRefs: document_id ? [`knowledge_base:${document_id}`] : ['input:raw-content'],
      reviewRequired: true,
      domain: 'labour',
    }));
  } catch (error) {
    logger.error('Summarization failed', { error });
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 });
  }
});
