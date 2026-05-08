// cognition-governance-ci: allow-route-bypass — Review workflow.
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
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

    const now = new Date();
    const [updated] = await db
      .update(exitInterviews)
      .set({
        status: 'reviewed',
        reviewedAt: now,
        reviewedBy: userId!,
        updatedAt: now,
        updatedBy: userId!,
      })
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .returning();

    await db.insert(exitInterviewEvents).values({
      interviewId: params.id,
      organizationId: organizationId!,
      eventType: 'reviewed',
      actorUserId: userId!,
      notes: body?.notes ?? 'Exit interview reviewed and approved for publishing',
      payload: { fromStatus: 'submitted', toStatus: 'reviewed', reviewedBy: userId },
    });

    return { data: updated };
  },
);
