/**
 * /api/ai/feedback — AI response feedback
 *
 * POST: Submit thumbs-up/down feedback on an AI-generated response.
 * GET:  Retrieve feedback records for a given query_id.
 *
 * Feedback is stored as rows in the `ai_usage_metrics` table with
 * operation = 'feedback' so it co-locates with the original AI call
 * and can be queried / reported by the same analytics pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { aiUsageMetrics } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

export const dynamic = 'force-dynamic';

const feedbackPostSchema = z.object({
  query_id: z.string().uuid('query_id must be a valid UUID'),
  rating: z.enum(['good', 'bad']),
  comment: z.string().max(2000).optional(),
});

export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  // Rate limit (lighter bucket – feedback is cheap)
  const rateLimitResult = await checkRateLimit(
    `ai-completion:${context.userId}`,
    RATE_LIMITS.AI_COMPLETION,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: createRateLimitHeaders(rateLimitResult) },
    );
  }

    // OWASP AI: Org presence check + feature flag + AI safety gate
    if (!context.organizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }
    const blocked = await guardAiFeature(AI_FEATURES.AI_FEEDBACK, { userId: context.userId, organizationId: context.organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'feedback', action: 'POST', organizationId: context.organizationId, userId: context.userId, userRole: 'member', dataClass: 'internal' });

  try {
    const body = await request.json();
    const validation = feedbackPostSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid feedback request',
        validation.error.errors,
      );
    }

    const { query_id, rating, comment } = validation.data;
    const orgId = context.organizationId as string;

    // Check for duplicate feedback from same user on same query
    const existing = await db
      .select({ id: aiUsageMetrics.id })
      .from(aiUsageMetrics)
      .where(
        and(
          eq(aiUsageMetrics.requestId, query_id),
          eq(aiUsageMetrics.operation, 'feedback'),
          eq(aiUsageMetrics.userId, context.userId!),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing feedback
      await withRLSContext(async () => db.execute(sql`
        UPDATE ai_usage_metrics
        SET metadata = jsonb_set(
          jsonb_set(metadata, '{rating}', ${JSON.stringify(rating)}::jsonb),
          '{comment}', ${JSON.stringify(comment ?? null)}::jsonb
        ),
        created_at = now()
        WHERE id = ${existing[0].id}
      `));

      return NextResponse.json({
        id: existing[0].id,
        query_id,
        rating,
        comment: comment ?? null,
        updated: true,
      });
    }

    // Insert new feedback row
    const inserted = await db
      .insert(aiUsageMetrics)
      .values({
        organizationId: orgId,
        provider: 'internal',
        model: 'feedback',
        operation: 'feedback',
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        estimatedCost: '0',
        requestId: query_id,
        userId: context.userId,
        metadata: { rating, comment: comment ?? null },
      })
      .returning({ id: aiUsageMetrics.id });

    return NextResponse.json({
      id: inserted[0].id,
      query_id,
      rating,
      comment: comment ?? null,
      created: true,
    });
  } catch (error) {
    logger.error('Feedback submission failed', { error });
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
});

export const GET = withRoleAuth('member', async (request: NextRequest, _context: BaseAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('query_id');

    if (!queryId) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'query_id parameter is required',
      );
    }

    const rows = await db
      .select({
        id: aiUsageMetrics.id,
        requestId: aiUsageMetrics.requestId,
        userId: aiUsageMetrics.userId,
        metadata: aiUsageMetrics.metadata,
        createdAt: aiUsageMetrics.createdAt,
      })
      .from(aiUsageMetrics)
      .where(
        and(
          eq(aiUsageMetrics.requestId, queryId),
          eq(aiUsageMetrics.operation, 'feedback'),
        ),
      );

    const feedback = rows.map((r) => ({
      id: r.id,
      query_id: r.requestId,
      user_id: r.userId,
      rating: (r.metadata as Record<string, unknown>)?.rating ?? null,
      comment: (r.metadata as Record<string, unknown>)?.comment ?? null,
      created_at: r.createdAt,
    }));

    return NextResponse.json({ query_id: queryId, feedback, count: feedback.length });
  } catch (error) {
    logger.error('Feedback retrieval failed', { error });
    return NextResponse.json({ error: 'Failed to retrieve feedback' }, { status: 500 });
  }
});
