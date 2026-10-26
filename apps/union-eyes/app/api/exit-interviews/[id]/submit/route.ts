// cognition-governance-ci: allow-route-bypass — Submission workflow.
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  const level = ROLE_HIERARCHY[normalized] ?? 0;
  return level >= ROLE_HIERARCHY.steward;
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Submit exit interview',
      description: 'Transitions an interview from draft to submitted for admin review.',
    },
  },
  async ({ params, organizationId, user, userId }) => {
    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound('Exit interview');
    }

    const stewardPlus = hasStewardPrivileges(user?.role ?? null);
    const isOwner = existing.createdBy === userId;
    if (!stewardPlus && !isOwner) {
      throw ApiError.forbidden('Only the owner or steward-level users can submit this interview');
    }

    if (existing.status !== 'draft') {
      throw ApiError.conflict('Only draft interviews can be submitted');
    }

    const now = new Date();
    const updated = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [row] = await tx
        .update(exitInterviews)
        .set({ status: 'submitted', submittedAt: now, updatedAt: now, updatedBy: userId! })
        .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'draft')))
        .returning();
      if (!row) throw ApiError.conflict('Only draft interviews can be submitted');

      await tx.insert(exitInterviewEvents).values({
        interviewId: params.id,
        organizationId: organizationId!,
        eventType: 'submitted',
        actorUserId: userId!,
        notes: 'Exit interview submitted for review',
        payload: { fromStatus: 'draft', toStatus: 'submitted' },
      });
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.submit',
        resourceType: 'exit_interviews',
        resourceId: params.id,
        details: { from: 'draft', to: 'submitted' },
      });
      return row;
    });

    return { data: updated };
  },
);
