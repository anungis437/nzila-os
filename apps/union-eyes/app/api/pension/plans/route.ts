import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPlanSchema = z.object({
  planName: z.string().max(255),
  planType: z.enum(['defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit']).optional(),
  status: z.enum(['active', 'frozen', 'terminated', 'pending_approval']).optional(),
  activeMembers: z.number().int().min(0).optional(),
  totalAssets: z.string().optional(),
  fundingStatus: z.string().optional(),
  description: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// A list answers at most this many rows.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List pension plans', description: 'List all pension plans for the organization' },
  },
  async ({ request: _request, organizationId }) => {
    const plans = await db
      .select()
      .from(pensionPlans)
      .where(eq(pensionPlans.organizationId, organizationId!))
      .orderBy(desc(pensionPlans.createdAt)).limit(LIST_LIMIT);
    return plans;
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

