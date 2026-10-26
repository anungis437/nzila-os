'use client';

import FinancialCapabilityUnavailable from '@/components/financial/FinancialCapabilityUnavailable';

/**
 * Affiliate remittance approval has no qualified workflow behind it, so no
 * approve/reject action is offered; see FinancialCapabilityUnavailable.
 */
export function CLCApprovalWorkflow(_props: Record<string, unknown>) {
  return <FinancialCapabilityUnavailable capability="affiliateRemittances" />;
}
