/**
 * GET /api/finance/dashboard — Finance dashboard summary for the current org
 *
 * Returns ledger summary, billing status, recent invoices,
 * allocation overview, and dues alignment anomalies.
 */

import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
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

export const GET = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { organizationId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  try {
    const url = new URL(request.url);
    const periodId = url.searchParams.get('periodId') ?? undefined;

    const [billingAccount, ledgerSummary, recentInvoices, recentChargebacks] =
      await Promise.all([
        getBillingAccount(organizationId),
        periodId
          ? getLedgerSummary({ organizationId, billingPeriodId: periodId })
          : Promise.resolve(null),
        getInvoices(organizationId, 5),
        getChargebacks({ organizationId, billingPeriodId: periodId }),
      ]);

    const duesReport = await generateDuesAlignmentReport(
      organizationId,
      periodId ?? 'current',
    );

    return standardSuccessResponse({
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
});
