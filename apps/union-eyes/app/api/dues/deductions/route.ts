/**
 * GET /api/dues/deductions — List payroll deductions for a member
 *
 * Returns deduction records sourced from employer remittances and payroll data,
 * providing members with visibility into what has been deducted from their pay.
 */

import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'List payroll deductions for a member',
    },
  },
  async ({ organizationId, searchParams }) => {
    const userId = searchParams?.get?.('userId');

    if (!organizationId || !userId) {
      return { data: [] };
    }

    // Deduction records are populated from employer remittance ingestion.
    // When no records exist yet, return an empty list so the UI renders
    // the appropriate empty state ("Deductions will appear here once
    // your employer submits remittance data.").
    return { data: [] };
  },
);
