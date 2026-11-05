'use client';

import FinancialCapabilityUnavailable from '@/components/financial/FinancialCapabilityUnavailable';

/**
 * Strike funds have no qualified record store (the former route was bound to
 * voting sessions); see FinancialCapabilityUnavailable.
 */
export default function StrikeFundDetailConsole(_props: { fundId: string }) {
  return <FinancialCapabilityUnavailable capability="strikeFunds" />;
}
