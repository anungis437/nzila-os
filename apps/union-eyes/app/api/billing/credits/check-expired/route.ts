/**
 * Billing Credits — Check Expired
 *
 * POST /api/billing/credits/check-expired — Expire past-due trials/credits
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { expireTrials } from '@/services/platform-economics/subscription-lifecycle-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Billing'], summary: 'Expire past-due trials and credits' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // expireTrials requires a payment-method checker callback
    const actions = await expireTrials(async (_orgId: string) => {
      // Default: assume no payment method on file — trials expire to cancelled
      return false;
    });

    logger.info('Expired trials check completed', { organizationId, expiredCount: actions.length });

    return { data: { expiredCount: actions.length, actions } };
  },
);
