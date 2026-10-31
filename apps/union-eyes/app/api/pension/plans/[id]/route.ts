import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updatePlanSchema = z.object({
  planName: z.string().max(255).optional(),
  planType: z.enum(['defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit']).optional(),
  status: z.enum(['active', 'frozen', 'terminated', 'pending_approval']).optional(),
  activeMembers: z.number().int().min(0).optional(),
  totalAssets: z.string().optional(),
  fundingStatus: z.string().optional(),
  description: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Get pension plan', description: 'Get a single pension plan by ID' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [plan] = await db
      .select()
      .from(pensionPlans)
      .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId!)));
    return plan ?? null;
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
