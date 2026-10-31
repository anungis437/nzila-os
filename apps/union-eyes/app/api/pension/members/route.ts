import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES, isPensionAdministrator } from '@/lib/pension/pension-authority';
import { pensionMembers, pensionPlans } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const createMemberSchema = z.object({
  planId: z.guid(),
  userId: z.guid().optional(),
  name: z.string().max(255),
  // The plan's name is read from the plan; accepted and ignored for compatibility.
  planName: z.string().max(255).optional(),
  enrollmentDate: z.coerce.date().optional(),
  membershipStatus: z.enum(['active', 'inactive', 'retired', 'deferred', 'terminated']).optional(),
  yearsOfService: z.string().regex(/^\d{1,3}(\.\d)?$/, 'yearsOfService must be a number with at most one decimal').optional(),
  vestingStatus: z.enum(['not_vested', 'partially_vested', 'fully_vested']).optional(),
});

export const dynamic = 'force-dynamic';

// A list answers at most this many rows per page; offset pages through the rest.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List pension members', description: 'List pension members by organization and optionally by plan' },
  },
  async ({ request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const page = listPage(request, LIST_LIMIT);
    const url = new URL(request.url);
    const planId = url.searchParams.get('planId');
    if (planId && !z.guid().safeParse(planId).success) throw ApiError.badRequest('planId must be a valid id');
    // The route lists the organization's pension members to a pension administrator (the read is recorded, since the rows are personal and
    // financial); every other caller is limited to their own enrolment.
    const administrator = isPensionAdministrator(user?.role);

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const conditions = [eq(pensionMembers.organizationId, organizationId)];
      if (planId) conditions.push(eq(pensionMembers.planId, planId));
      if (!administrator) {
        // pensionMembers.userId stores the organization_members.id (UUID PK), not the auth provider string id.
        conditions.push(
          sql`${pensionMembers.userId} = (
            SELECT id FROM organization_members
            WHERE user_id = ${userId}
              AND organization_id = ${organizationId}::uuid
            LIMIT 1
          )`,
        );
      }
      const members = await tx
        .select()
        .from(pensionMembers)
        .where(and(...conditions))
        .orderBy(desc(pensionMembers.createdAt)).limit(page.limit).offset(page.offset);
      if (administrator) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'pension.members.read',
          resourceType: 'pension_members',
          resourceId: organizationId,
          details: { rows: members.length, ...(planId ? { planId } : {}) },
        });
      }
      return members;
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Pension'], summary: 'Enroll pension member', description: 'Enroll a new member in a pension plan' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createMemberSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      // The plan must be this organization's, and the member is enrolled under that plan's own name.
      const [plan] = await tx
        .select({ id: pensionPlans.id, planName: pensionPlans.planName })
        .from(pensionPlans)
        .where(and(eq(pensionPlans.id, parsed.planId), eq(pensionPlans.organizationId, organizationId)))
        .limit(1);
      if (!plan) throw ApiError.notFound('Pension plan');
      const [member] = await tx
        .insert(pensionMembers)
        .values({ ...parsed, planName: plan.planName, organizationId })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.member.enroll',
        resourceType: 'pension_members',
        resourceId: member.id,
        details: { planId: parsed.planId },
      });
      return member;
    });
  },
);


