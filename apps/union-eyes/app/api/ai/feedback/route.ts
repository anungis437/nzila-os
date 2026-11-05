/**
 * /api/ai/feedback — AI response feedback
 *
 * POST: Submit thumbs-up/down feedback on an AI-generated response.
 * GET:  Retrieve the caller's feedback for a given query_id.
 *
 * Feedback is stored as rows in the `ai_usage_metrics` table with
 * operation = 'feedback' so it co-locates with the original AI call
 * and can be queried / reported by the same analytics pipeline.
 *
 * `ai_usage_metrics` is an append-only metering ledger (the runtime role may select and insert, never update): a user who changes their feedback on a
 * query adds a newer row, and the newest row is the user's current feedback. Earlier rows stay as the history of the change.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { aiUsageMetrics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

export const dynamic = 'force-dynamic';

const feedbackPostSchema = z.object({
  query_id: z.guid('query_id must be a valid UUID'),
  rating: z.enum(['good', 'bad']),
  comment: z.string().max(2000).optional(),
});

// Both handlers keep what a caller with no active organization was answered (400, below): `requireOrg: false` leaves that to them, not the wrapper's 403.
export const POST = withApi(
  {
    auth: { minRole: 'member' },
    requireOrg: false,
    body: feedbackPostSchema,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Submit feedback on an AI response' },
  },
  async ({ user, userId, organizationId, body }) => {
    // Rate limit (lighter bucket – feedback is cheap)
    const rateLimitResult = await checkRateLimit(
      `ai-completion:${userId}`,
      RATE_LIMITS.AI_COMPLETION,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) },
      );
    }

    // OWASP AI: Org presence check + feature flag + AI safety gate
    if (!organizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }
    const blocked = await guardAiFeature(AI_FEATURES.AI_FEEDBACK, { userId: userId!, organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'feedback', action: 'POST', organizationId, userId, userRole: user?.role ?? 'member', dataClass: 'internal' });

    try {
      const { query_id, rating, comment } = body;
      const orgId = organizationId;
      const feedbackUserId = userId as string;

      // The feedback row and its audit record commit together; a user's feedback is written onto the user's own organization and never onto another
      // user's row. Feedback the user already gave on this query is not rewritten: the new row follows it.
      const saved = await withRLSContext({ organizationId: orgId }, async (tx) => {
        const [previous] = await tx
          .select({ id: aiUsageMetrics.id })
          .from(aiUsageMetrics)
          .where(
            and(
              eq(aiUsageMetrics.requestId, query_id),
              eq(aiUsageMetrics.operation, 'feedback'),
              eq(aiUsageMetrics.userId, feedbackUserId),
              eq(aiUsageMetrics.organizationId, orgId),
            ),
          )
          .limit(1);

        const [inserted] = await tx
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
            userId: feedbackUserId,
            metadata: { rating, comment: comment ?? null },
          })
          .returning({ id: aiUsageMetrics.id });
        await persistAtomicAudit(tx, {
          organizationId: orgId,
          userId: feedbackUserId,
          action: previous ? 'ai.feedback.update' : 'ai.feedback.create',
          resourceType: 'ai_usage_metrics',
          resourceId: inserted.id,
          details: { queryId: query_id, rating, ...(previous ? { supersedes: previous.id } : {}) },
        });
        return { id: inserted.id, updated: Boolean(previous) };
      });

      return NextResponse.json({
        id: saved.id,
        query_id,
        rating,
        comment: comment ?? null,
        ...(saved.updated ? { updated: true } : { created: true }),
      });
    } catch (error) {
      logger.error('Feedback submission failed', { error });
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }
  },
);

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    requireOrg: false,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'The caller\'s current feedback on an AI response' },
  },
  async ({ request, userId, organizationId }) => {
    try {
      // ROUND 48 SECURITY FIX: this endpoint previously had zero tenant
      // scoping — any authenticated member of ANY organization could read
      // another organization's AI feedback rows (rating/comment/userId) by
      // guessing/enumerating a query_id. Feedback must be scoped to the
      // caller's own organization.
      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'No active organization',
        );
      }

      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const queryId = searchParams.get('query_id');

      if (!queryId) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'query_id parameter is required',
        );
      }

      // The caller's current feedback on the query: the newest row, in the organization's own context.
      const rows = await withRLSContext({ organizationId }, (tx) =>
        tx
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
              eq(aiUsageMetrics.organizationId, organizationId),
              eq(aiUsageMetrics.userId, userId),
            ),
          )
          .orderBy(desc(aiUsageMetrics.createdAt))
          .limit(1),
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
  },
);
