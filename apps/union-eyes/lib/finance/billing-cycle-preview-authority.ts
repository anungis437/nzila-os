/**
 * Billing preview is financial data. The caller must hold an ACTIVE
 * membership in the organization AND a verified ledger-view mandate.
 * A platform role does not grant cross-tenant finance rights.
 */
import { resolveOrganizationAccess } from '@/lib/organizations/read-authority';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';

export class BillingPreviewAuthorityError extends Error {
  constructor(message = 'A verified financial viewing mandate for the requested organization is required') {
    super(message);
    this.name = 'BillingPreviewAuthorityError';
  }
}

export async function requireAuthorizedBillingPreview(userId: string, organizationId: string): Promise<void> {
  if (!userId || !organizationId) throw new BillingPreviewAuthorityError();
  const access = await resolveOrganizationAccess(userId);
  if (!access.direct.has(organizationId)) throw new BillingPreviewAuthorityError();
  try {
    await withRLSContext({ organizationId, userId }, async tx => {
      await requireLiveFinancialMandate(tx, {
        userId, organizationId, action: 'finance:view', requiresLedger: true,
      });
    });
  } catch {
    // Never disclose whether the target organization has a mandate or a ledger.
    throw new BillingPreviewAuthorityError();
  }
}
