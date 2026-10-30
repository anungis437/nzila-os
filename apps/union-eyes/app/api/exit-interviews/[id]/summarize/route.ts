// cognition-governance-ci: allow-route-bypass — Summarization workflow with parameters.
/**
 * POST /api/exit-interviews/[id]/summarize
 *
 * Generates (or regenerates) an AI knowledge summary for a published interview.
 * Stores the result in the aiSummary + aiSummaryGeneratedAt columns.
 *
 * Access: steward+, own org, published status only
 */

import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { generateKnowledgeSummary } from '@/lib/knowledge-transfer/summaries/knowledge-summarizer';
import { SENSITIVITY_MIN_ROLE } from '@/lib/knowledge-transfer/governance/consent-controls';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

function roleAtLeast(role: string | null, minRole: string): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  return (ROLE_HIERARCHY[normalized] ?? 0) >= (ROLE_HIERARCHY[minRole as keyof typeof ROLE_HIERARCHY] ?? Infinity);
}

function hasStewardPrivileges(role: string | null): boolean {
  return roleAtLeast(role, 'steward');
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Generate AI knowledge summary',
      description: 'Produces a traceable AI operational handoff summary for a published exit interview.',
    },
  },
  async ({ params, organizationId, userId, user }) => {
    if (!hasStewardPrivileges(user?.role ?? null)) {
      throw ApiError.forbidden('Steward-level access required');
    }

    const [interview] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!interview) throw ApiError.notFound('Exit interview');

    // Interview content is read and sent to the AI provider, so the caller must hold the role the interview's
    // sensitivity level requires; below it the interview is not disclosed at all.
    const minRole = SENSITIVITY_MIN_ROLE[interview.sensitivityLevel as keyof typeof SENSITIVITY_MIN_ROLE];
    if (!minRole || !roleAtLeast(user?.role ?? null, minRole)) {
      throw ApiError.notFound('Exit interview');
    }

    if (interview.status !== 'published') {
      throw ApiError.conflict('Summaries can only be generated for published interviews');
    }
    // A revoked interview must not reach an AI provider or create new
    // derivatives even if the caller remains a steward or administrator.
    // Separate model-processing consent remains a distinct unimplemented
    // requirement; this is the minimum revocation floor.
    if (interview.consentGranted !== true) {
      throw ApiError.conflict('Retiree consent has not been granted or has been withdrawn');
    }

    let summary: Awaited<ReturnType<typeof generateKnowledgeSummary>>;
    try {
      // The provider call cannot share the database transaction: its intent is recorded first and it is skipped if
      // that record cannot be written.
      summary = await performAuditedOperation(
        {
          organizationId: organizationId!,
          userId: userId!,
          action: 'exit_interview.summarize.generate',
          resourceType: 'exit_interviews',
          resourceId: params.id,
          details: { sensitivityLevel: interview.sensitivityLevel },
        },
        () => generateKnowledgeSummary(interview),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
    const now = new Date();

    await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [stored] = await tx
        .update(exitInterviews)
        .set({
          aiSummary: summary.operationalSummary,
          aiSummaryGeneratedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(exitInterviews.id, params.id),
            eq(exitInterviews.organizationId, organizationId!),
            eq(exitInterviews.status, 'published'),
          ),
        )
        .returning({ id: exitInterviews.id });
      if (!stored) throw ApiError.conflict('The interview is no longer published');

      await tx.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'summarized',
        actorUserId: userId!,
        notes: 'AI knowledge summary generated',
        payload: { generatedAt: now.toISOString() },
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.summarize',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: { generatedAt: now.toISOString() },
      });
    });

    return { data: summary };
  },
);
