/**
 * A billing-cycle run affects every active member of the selected organization.
 * A platform role title is not authority to charge an arbitrary union.
 * The caller must hold a live, ledger-wide financial execution mandate for
 * that exact organization, including dry-run previews of sensitive amounts.
 */
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';

export async function requireBillingCycleAuthority(organizationId: string, userId: string): Promise<void> {
  await withRLSContext({ organizationId, userId }, async (tx) => {
    await requireLiveFinancialMandate(tx, {
      organizationId,
      userId,
      action: 'finance:execute',
      requiresLedger: true,
    });
  });
}
