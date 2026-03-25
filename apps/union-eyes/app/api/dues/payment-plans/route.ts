/**
 * GET  /api/dues/payment-plans — List payment plans for the org
 * POST /api/dues/payment-plans — Create a payment plan
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { db } from '@/db';
import { paymentPlans } from '@/db/schema/dues-finance-schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const createPlanSchema = z.object({
  userId: z.string(),
  planName: z.string().min(1).max(255),
  totalOwed: z.string(),
  installmentAmount: z.string(),
  installmentCount: z.number().int().positive(),
  frequency: z.enum(['weekly', 'bi_weekly', 'monthly']).default('monthly'),
  startDate: z.coerce.date(),
  nextPaymentDue: z.coerce.date(),
});

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Dues'],
      summary: 'List payment plans for the organization',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const plans = await db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.organizationId, organizationId))
      .orderBy(desc(paymentPlans.createdAt));
    return { plans };
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    body: createPlanSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: 'Create a dues payment plan',
    },
  },
  async ({ body, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [plan] = await db
      .insert(paymentPlans)
      .values({
        organizationId,
        userId: body.userId,
        planName: body.planName,
        totalOwed: body.totalOwed,
        installmentAmount: body.installmentAmount,
        installmentCount: body.installmentCount,
        frequency: body.frequency,
        startDate: body.startDate,
        remainingBalance: body.totalOwed,
        nextPaymentDue: body.nextPaymentDue,
        status: 'active',
      })
      .returning();
    return plan;
  },
);
