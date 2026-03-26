/**
 * GET /api/dues/billing-cycle — List billing periods for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { billingPeriods, billingSubscriptions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Dues'],
      summary: 'List billing periods and subscription cycles',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const periods = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.organizationId, organizationId))
      .orderBy(desc(billingPeriods.createdAt));

    const subscriptions = await db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.organizationId, organizationId))
      .orderBy(desc(billingSubscriptions.createdAt));

    return { periods, subscriptions };
  },
);
