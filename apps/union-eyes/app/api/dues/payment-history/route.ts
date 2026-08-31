/**
 * GET /api/dues/payment-history — List the authenticated member's dues
 * payment history, backed by the native member_dues_ledger table.
 */

import { withApi } from '@/lib/api/framework';
import { db } from '@/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const STATUS_MAP: Record<string, 'completed' | 'pending' | 'failed' | 'refunded'> = {
  posted: 'completed',
  pending: 'pending',
  reversed: 'refunded',
  voided: 'failed',
};

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: "List the authenticated member's dues payment history",
    },
  },
  async ({ userId, organizationId, request }) => {
    if (!userId || !organizationId) return { data: [] };

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    const rows = await db
      .select()
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.userId, userId),
          eq(memberDuesLedger.organizationId, organizationId),
          eq(memberDuesLedger.transactionType, 'payment'),
        ),
      )
      .orderBy(desc(memberDuesLedger.transactionDate))
      .limit(limit);

    const data = rows.map((r) => ({
      id: r.id,
      date: new Date(r.transactionDate).toISOString(),
      amount: Number(r.amount),
      // No late-fee concept is tracked in the native ledger — genuinely 0, not a placeholder.
      lateFeeAmount: 0,
      totalAmount: Number(r.amount),
      status: STATUS_MAP[r.status] ?? 'pending',
      paymentMethod: r.paymentMethod ?? 'unknown',
      periodStart: (r.periodStart ? new Date(r.periodStart) : new Date(r.transactionDate)).toISOString(),
      periodEnd: (r.periodEnd ? new Date(r.periodEnd) : new Date(r.transactionDate)).toISOString(),
      receiptUrl: r.receiptNumber ? `/api/dues/receipt/${r.id}` : undefined,
    }));

    return { data };
  },
);
