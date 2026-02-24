import { NextResponse } from 'next/server';
/**
 * GET /api/portal/dues/balance
 * Migrated to withApi() framework
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, desc } from 'drizzle-orm';

 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Portal'],
      summary: 'GET balance',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {
        if (!userId) throw ApiError.unauthorized('User not authenticated');

        // Get the organizationId from query params or header
        const orgId = request.nextUrl.searchParams.get('organizationId')
          || request.headers.get('x-organization-id');
        if (!orgId) {
          return NextResponse.json(
            { error: 'Missing organizationId query parameter or x-organization-id header' },
            { status: 400 },
          );
        }
        // Current balance: sum of all posted ledger entries for this member
        const [balanceRow] = await db
          .select({
            totalCharges: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'charge' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
            totalPayments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'payment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
            totalCredits: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'credit' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
            totalAdjustments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'adjustment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
            totalWriteOffs: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'write_off' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
            transactionCount: sql<string>`COUNT(*)`,
          })
          .from(memberDuesLedger)
          .where(
            and(
              eq(memberDuesLedger.userId, userId),
              eq(memberDuesLedger.organizationId, orgId),
              eq(memberDuesLedger.status, 'posted'),
            ),
          );
        const charges = parseFloat(balanceRow?.totalCharges ?? '0');
        const payments = parseFloat(balanceRow?.totalPayments ?? '0');
        const credits = parseFloat(balanceRow?.totalCredits ?? '0');
        const adjustments = parseFloat(balanceRow?.totalAdjustments ?? '0');
        const writeOffs = parseFloat(balanceRow?.totalWriteOffs ?? '0');
        // Balance = charges - (payments + credits + adjustments + write-offs)
        const currentBalance = charges - payments - credits - adjustments - writeOffs;
        // Last 5 transactions for recent-activity summary
        const recentTransactions = await db
          .select({
            id: memberDuesLedger.id,
            type: memberDuesLedger.transactionType,
            amount: memberDuesLedger.amount,
            date: memberDuesLedger.transactionDate,
            description: memberDuesLedger.description,
            balanceAfter: memberDuesLedger.balanceAfter,
          })
          .from(memberDuesLedger)
          .where(
            and(
              eq(memberDuesLedger.userId, userId),
              eq(memberDuesLedger.organizationId, orgId),
              eq(memberDuesLedger.status, 'posted'),
            ),
          )
          .orderBy(desc(memberDuesLedger.transactionDate))
          .limit(5);
        return { data: {
            currentBalance: currentBalance.toFixed(2),
            balanceStatus: currentBalance <= 0 ? 'paid_up' : currentBalance > 0 ? 'owing' : 'credit',
            breakdown: {
              totalCharges: charges.toFixed(2),
              totalPayments: payments.toFixed(2),
              totalCredits: credits.toFixed(2),
              totalAdjustments: adjustments.toFixed(2),
              totalWriteOffs: writeOffs.toFixed(2),
            },
            transactionCount: parseInt(balanceRow?.transactionCount ?? '0', 10),
            recentTransactions,
          }, };
  },
);
