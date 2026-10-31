/**
 * GET /api/assurance/finance/ledger — read-only assurance view of the organization's dues ledger (R-33, Governance Officer G21).
 *
 * Authority is a live financial mandate that holds the `audit` power on the organization ledger. It is not a role: the
 * finance routes' role allow-list is a frozen decision and stays as it is. An audit mandate carries no preparation,
 * approval, execution or reconciliation power, and this route can read nothing it could change. Every read is audited.
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getLedgerEntries } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Assurance'],
      summary: 'Read-only dues ledger for the holder of an audit mandate',
    },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);

    const grant = await withRLSContext({ organizationId, userId }, async (tx) => {
      const mandate = await requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:audit', requiresLedger: true });
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'assurance.finance.ledger_read',
        resourceType: 'dues_ledger',
        resourceId: organizationId,
        details: { mandateId: mandate.mandateId, limit, offset },
      });
      return mandate;
    });

    const entries = await getLedgerEntries({ organizationId, limit, offset });
    return { entries, readOnly: true, authority: { mandateId: grant.mandateId, power: 'audit' } };
  },
);
