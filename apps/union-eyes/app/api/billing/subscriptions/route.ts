/**
 * GET  /api/billing/subscriptions — List subscriptions for the org
 * POST /api/billing/subscriptions — Pause or resume a subscription
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { rowsVisibleToGrant } from '@/lib/finance/principal-financial-authority';
import { orgSubscriptions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { pauseSubscription, resumeSubscription } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  subscriptionId: z.guid(),
  action: z.enum(['pause', 'resume']),
  reason: z.string().trim().max(500).optional(),
});

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Billing'],
      summary: 'List organization subscriptions',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // A role and entitlement are not financial authority. The caller sees only
    // subscriptions named by their live view mandate, or the organization ledger.
    const subscriptions = await withRLSContext({ organizationId, userId }, async (tx) => {
      const grant = await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view' });
      return tx
        .select()
        .from(orgSubscriptions)
        .where(rowsVisibleToGrant(grant, organizationId, orgSubscriptions.organizationId, orgSubscriptions.id))
        .orderBy(desc(orgSubscriptions.createdAt))
        .limit(200);
    });
    return { subscriptions };
  },
);

export const POST = withApi(
  {
    // Pausing or resuming billing requires administrator role AND a live execute mandate.
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    body: actionSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Billing'],
      summary: 'Pause or resume a subscription',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // Authorize the particular subscription before any service call. The service
    // must independently enforce tenant scope when applying the transition.
    await withRLSContext({ organizationId, userId }, async (tx) => {
      await requireLiveFinancialMandate(tx, {
        organizationId, userId, action: 'finance:execute', resourceId: body.subscriptionId,
      });
    });
    if (body.action === 'pause') {
      const result = await pauseSubscription(organizationId, body.subscriptionId, userId!, body.reason);
      return { ...result };
    }
    const result = await resumeSubscription(organizationId, body.subscriptionId, userId!);
    return { ...result };
  },
);
