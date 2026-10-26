/**
 * GET /api/reconciliation/bank — List reconciliation runs for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
import { reconciliationRuns } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'commercial_reporting',
    openapi: {
      tags: ['Reconciliation'],
      summary: 'List reconciliation runs for the organization',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view', requiresLedger: true }),
    );
    const runs = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId))
      .orderBy(desc(reconciliationRuns.createdAt));
    return { runs };
  },
);
