'use client';

import FinancialCapabilityUnavailable from '@/components/financial/FinancialCapabilityUnavailable';

/**
 * Affiliate remittances have no qualified record store (the former route was
 * bound to organization members); see FinancialCapabilityUnavailable.
 */
export function ClcRemittancesDashboard() {
  return <FinancialCapabilityUnavailable capability="affiliateRemittances" />;
}
