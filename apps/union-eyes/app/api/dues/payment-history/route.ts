/**
 * GET /api/dues/payment-history — List payment history for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { platformPayments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Dues'],
      summary: 'List payment history for the organization',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    const payments = await db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.organizationId, organizationId))
      .orderBy(desc(platformPayments.createdAt))
      .limit(limit);
    return { payments };
  },
);
