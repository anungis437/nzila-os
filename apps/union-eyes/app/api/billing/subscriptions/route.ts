/**
 * GET  /api/billing/subscriptions — List subscriptions for the org
 * POST /api/billing/subscriptions — Pause or resume a subscription
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { db } from '@/db';
import { orgSubscriptions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { pauseSubscription, resumeSubscription } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(['pause', 'resume']),
  reason: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Billing'],
      summary: 'List organization subscriptions',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const subscriptions = await db
      .select()
      .from(orgSubscriptions)
      .where(eq(orgSubscriptions.organizationId, organizationId))
      .orderBy(desc(orgSubscriptions.createdAt));
    return { subscriptions };
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    body: actionSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Pause or resume a subscription',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (body.action === 'pause') {
      const result = await pauseSubscription(organizationId, body.subscriptionId, userId!, body.reason);
      return { ...result };
    }
    const result = await resumeSubscription(organizationId, body.subscriptionId, userId!);
    return { ...result };
  },
);
