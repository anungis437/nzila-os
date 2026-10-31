import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES, isPensionAdministrator } from '@/lib/pension/pension-authority';
import { PLAN_STATUSES, PLAN_TYPES, activeEnrolmentCount, memberSafePlan, planFigureFields } from '@/lib/pension/plan-input';
import { pensionPlans } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updatePlanSchema = z.object({
  planName: z.string().max(255).optional(),
  planType: z.enum(PLAN_TYPES).optional(),
  status: z.enum(PLAN_STATUSES).optional(),
  ...planFigureFields,
  description: z.string().max(4000).optional(),
}).strict();

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Get pension plan', description: 'Get a single pension plan by ID' },
  },
  async ({ params, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [row] = await tx
        .select({ plan: pensionPlans, activeMembers: activeEnrolmentCount(pensionPlans.id) })
        .from(pensionPlans)
        .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)));
      if (!row) throw ApiError.notFound('Pension plan');
      // The assets and funding figures are an administrator's record; the member view carries no figure.
      return isPensionAdministrator(user?.role) ? { ...row.plan, activeMembers: row.activeMembers } : memberSafePlan(row.plan);
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Pension'], summary: 'Update pension plan', description: 'Update an existing pension plan' },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    const changes = updatePlanSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [plan] = await tx
        .update(pensionPlans)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)))
        .returning();
      if (!plan) throw ApiError.notFound('Pension plan');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.plan.update',
        resourceType: 'pension_plans',
        resourceId: id,
        details: { fields: Object.keys(changes), status: changes.status },
      });
      return plan;
    });
  },
);

/**
 * DELETE ends a plan; it does not remove the row. A plan carries enrolments, contributions and benefit claims, so deleting it would
 * orphan or cascade that history. The plan is marked terminated, with the time, and stays readable to the administrators; a plan
 * that is already terminated answers 409.
 */
export const DELETE = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Pension'], summary: 'Terminate pension plan', description: 'Marks a pension plan terminated; the record and its history are kept' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    return withRLSContext({ organizationId }, async (tx) => {
      const [plan] = await tx
        .update(pensionPlans)
        .set({ status: 'terminated', updatedAt: new Date() })
        .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId), ne(pensionPlans.status, 'terminated')))
        .returning();
      if (!plan) {
        const [existing] = await tx
          .select({ id: pensionPlans.id })
          .from(pensionPlans)
          .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)))
          .limit(1);
        if (!existing) throw ApiError.notFound('Pension plan');
        throw ApiError.conflict('The pension plan is already terminated');
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.plan.terminate',
        resourceType: 'pension_plans',
        resourceId: id,
        details: { planName: plan.planName },
      });
      return plan;
    });
  },
);
