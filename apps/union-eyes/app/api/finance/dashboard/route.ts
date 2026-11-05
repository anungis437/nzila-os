/**
 * GET /api/finance/dashboard — Finance dashboard summary for the current org
 *
 * Returns ledger summary, billing status, recent invoices,
 * allocation overview, and dues alignment anomalies.
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import {
  getLedgerSummary,
  getBillingAccount,
  getInvoices,
  getChargebacks,
} from '@/services/platform-economics';
import { generateDuesAlignmentReport } from '@/services/platform-economics/dues-alignment';

export const dynamic = 'force-dynamic';

// A malformed period id is a client error, never a database fault handed back as a 500.
const querySchema = z.object({
  periodId: z.guid().optional(),
});

// Everything the dashboard reads is the caller organization's own: it runs in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    query: querySchema,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Finance dashboard summary of the current organization' },
  },
  async ({ organizationId, query }) => {
    try {
      const orgId = organizationId!;
      const periodId = query.periodId;

      const [billingAccount, ledgerSummary, recentInvoices, recentChargebacks] =
        await Promise.all([
          getBillingAccount(orgId),
          periodId
            ? getLedgerSummary({ organizationId: orgId, billingPeriodId: periodId })
            : Promise.resolve(null),
          getInvoices(orgId, 5),
          getChargebacks({ organizationId: orgId, billingPeriodId: periodId }),
        ]);

      const duesReport = await generateDuesAlignmentReport(
        orgId,
        periodId ?? 'current',
      );

      return standardSuccessResponse({
        domain: 'NZILA_PLATFORM_BILLING',
        notUnionFinancialRecords: true,
        billingAccount,
        ledgerSummary,
        recentInvoices,
        recentChargebacks: recentChargebacks.slice(0, 10),
        duesAlignment: {
          anomalyCount: duesReport.anomalies.length,
          anomalies: duesReport.anomalies,
          memberCount: duesReport.orgSnapshot.totalMembers,
          arrearsCount: duesReport.orgSnapshot.arrearsCount,
        },
      });
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to load dashboard', error);
    }
  },
);
