/**
 * GET /api/dues/deductions — List payroll deductions for a member
 *
 * Returns deduction records sourced from employer remittances and payroll data,
 * providing members with visibility into what has been deducted from their pay.
 */

import { withApi } from '@/lib/api/framework';
import { db } from '@/db';
import { payrollDeductions } from '@/db/schema/dues-finance-schema';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// What a member sees of their own deductions. The identity of the staff member who verified one, the remittance line it came from, the employer and
// free-form metadata are internal and stay out of this read; the history a member needs is the period, the amounts, where it came from and whether it is verified.
const MEMBER_VISIBLE_COLUMNS = {
  id: payrollDeductions.id,
  payPeriodStart: payrollDeductions.payPeriodStart,
  payPeriodEnd: payrollDeductions.payPeriodEnd,
  grossPay: payrollDeductions.grossPay,
  netPay: payrollDeductions.netPay,
  unionDuesAmount: payrollDeductions.unionDuesAmount,
  source: payrollDeductions.source,
  verified: payrollDeductions.verified,
  verifiedAt: payrollDeductions.verifiedAt,
  createdAt: payrollDeductions.createdAt,
};
// One row per pay period: a member's history is bounded, and this keeps a runaway import from becoming an unbounded read.
const MAX_ROWS = 1000;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    // The read goes through the ambient handle, so it must run inside a tenant transaction: payroll_deductions is under forced row security, and
    // outside one the runtime role has no organization and sees no row (the legacy topology only opts in; Canonical V2 always does).
    rlsOrgContext: true,
    openapi: {
      tags: ['Dues'],
      summary: 'List payroll deductions for the authenticated member',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) {
      return { data: [] };
    }

    const rows = await db
      .select(MEMBER_VISIBLE_COLUMNS)
      .from(payrollDeductions)
      .where(and(eq(payrollDeductions.organizationId, organizationId), eq(payrollDeductions.userId, userId)))
      .orderBy(desc(payrollDeductions.payPeriodStart))
      .limit(MAX_ROWS);

    return { data: rows };
  },
);
