/**
 * GET /api/dues/deductions — List payroll deductions for a member
 *
 * Returns deduction records sourced from employer remittances and payroll data,
 * providing members with visibility into what has been deducted from their pay.
 */

import { withApi } from '@/lib/api/framework';
import { db } from '@/db';
import { payrollDeductions } from '@/db/schema/dues-finance-schema';
import { and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'List payroll deductions for a member',
    },
  },
  async ({ organizationId, request }) => {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!organizationId || !userId) {
      return { data: [] };
    }

    // organizationId is a text slug; payrollDeductions.organizationId is uuid — cast for comparison
    const rows = await db
      .select()
      .from(payrollDeductions)
      .where(
        and(
          sql`${payrollDeductions.organizationId}::text = ${organizationId}`,
          sql`${payrollDeductions.userId}::text = ${userId}`,
        ),
      );

    return { data: rows };
  },
);
