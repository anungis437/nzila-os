import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES, isPensionAdministrator } from '@/lib/pension/pension-authority';
import { PLAN_STATUSES, PLAN_TYPES, activeEnrolmentCount, memberSafePlan, planFigureFields } from '@/lib/pension/plan-input';
import { pensionPlans } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPlanSchema = z.object({
  planName: z.string().max(255),
  planType: z.enum(PLAN_TYPES).optional(),
  status: z.enum(PLAN_STATUSES).optional(),
  ...planFigureFields,
  description: z.string().max(4000).optional(),
}).strict();

export const dynamic = 'force-dynamic';

// A list answers at most this many rows per page; offset pages through the rest.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List pension plans', description: 'List all pension plans for the organization' },
  },
  async ({ request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const page = listPage(request, LIST_LIMIT);
    // A member sees which plans exist; the assets and funding figures are an administrator's record and the active-member count is
    // counted from enrolments, not typed.
    const administrator = isPensionAdministrator(user?.role);
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const rows = await tx
        .select({ plan: pensionPlans, activeMembers: activeEnrolmentCount(pensionPlans.id) })
        .from(pensionPlans)
        .where(eq(pensionPlans.organizationId, organizationId))
        .orderBy(desc(pensionPlans.createdAt)).limit(page.limit).offset(page.offset);
      return rows.map(({ plan, activeMembers }) => (administrator ? { ...plan, activeMembers } : memberSafePlan(plan)));
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Pension'], summary: 'Create pension plan', description: 'Create a new pension plan' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createPlanSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [plan] = await tx
        .insert(pensionPlans)
        .values({ ...parsed, organizationId })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.plan.create',
        resourceType: 'pension_plans',
        resourceId: plan.id,
        details: { planName: parsed.planName, planType: parsed.planType },
      });
      return plan;
    });
  },
);

