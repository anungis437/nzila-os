'use client';

import FinancialCapabilityUnavailable from '@/components/financial/FinancialCapabilityUnavailable';

/** Budget detail has no qualified record store; see FinancialCapabilityUnavailable. */
export default function BudgetDetailClient() {
  return <FinancialCapabilityUnavailable capability="budgets" />;
}
