/**
 * GET /api/dues/balance — Get dues balance summary for the org
 */

import { withApi } from '@/lib/api/framework';
import { getLedgerSummary } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const EMPTY_BALANCE = {
  currentBalance: 0,
  nextDueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  nextDueAmount: 0,
  overdueAmount: 0,
  lastPaymentDate: null,
  lastPaymentAmount: 0,
  isInArrears: false,
  arrearsAmount: 0,
  membershipStatus: 'active',
  autoPayEnabled: false,
  paymentMethodLast4: null,
  totalAmountCad: '0.00',
  entryCount: 0,
  byCostType: {},
};

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: 'Get dues balance summary for the organization',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) {
      return EMPTY_BALANCE;
    }

    const summary = await getLedgerSummary({ organizationId });

    // Map ledger summary to the shape the frontend DuesBalance interface expects
    const totalAmount = Number(summary.totalAmountCad) || 0;
    return {
      currentBalance: totalAmount,
      nextDueDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      nextDueAmount: 0,
      overdueAmount: 0,
      lastPaymentDate: new Date().toISOString(),
      lastPaymentAmount: 0,
      isInArrears: totalAmount > 0,
      arrearsAmount: totalAmount > 0 ? totalAmount : 0,
      membershipStatus: 'active',
      autoPayEnabled: false,
      paymentMethodLast4: null,
      // Original ledger data
      ...summary,
    };
  },
);
