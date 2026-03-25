/**
 * GET /api/reconciliation/bank — List reconciliation runs for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { reconciliationRuns } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    openapi: {
      tags: ['Reconciliation'],
      summary: 'List reconciliation runs for the organization',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const runs = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId))
      .orderBy(desc(reconciliationRuns.createdAt));
    return { runs };
  },
);
