// cognition-governance-ci: allow-route-bypass — Review workflow.
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  notes: z.string().max(2000).optional(),
});

function hasOfficerPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  const level = ROLE_HIERARCHY[normalized] ?? 0;
  return level >= ROLE_HIERARCHY.officer;
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: reviewSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Mark exit interview as reviewed',
      description: 'Officer/admin marks a submitted interview as reviewed, ready for publishing.',
    },
  },
  async ({ params, body, organizationId, userId, user }) => {
    if (!hasOfficerPrivileges(user?.role ?? null)) {
      throw ApiError.forbidden('Only officer-level users or above can mark interviews as reviewed');
    }

    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound('Exit interview');
    }

    if (existing.status !== 'submitted') {
      throw ApiError.conflict('Only submitted interviews can be marked as reviewed');
    }

    // A review is an independent check: the person who wrote the interview does not review it.
    if (existing.createdBy === userId) {
      throw ApiError.forbidden('The author of an exit interview cannot review it');
    }
    // Nor does whoever last changed it: the record keeps no separate submitter, so the last editor stands in for the person who prepared the
    // interview for review.
    // The submitter is recorded; an interview submitted before that was kept falls back to its last editor.
    const submitter = existing.submittedBy ?? existing.updatedBy;
    if (submitter && submitter === userId) {
      throw ApiError.forbidden('The person who submitted an exit interview cannot review it');
    }

    const now = new Date();
    const updated = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [row] = await tx
        .update(exitInterviews)
        .set({
          status: 'reviewed',
          reviewedAt: now,
          reviewedBy: userId!,
          updatedAt: now,
          updatedBy: userId!,
        })
        .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'submitted')))
        .returning();
      if (!row) throw ApiError.conflict('Only submitted interviews can be marked as reviewed');

      await tx.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'reviewed',
        actorUserId: userId!,
        notes: body?.notes ?? 'Exit interview reviewed and approved for publishing',
        payload: { fromStatus: 'submitted', toStatus: 'reviewed', reviewedBy: userId },
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.review',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: { from: 'submitted', to: 'reviewed' },
      });
      return row;
    });

    return { data: updated };
  },
);
