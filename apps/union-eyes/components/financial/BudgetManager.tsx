'use client';

import FinancialCapabilityUnavailable from './FinancialCapabilityUnavailable';

interface BudgetManagerProps {
  organizationId?: string | null;
}

/** Union budgets have no qualified record store; see FinancialCapabilityUnavailable. */
export default function BudgetManager(_props: BudgetManagerProps) {
  return <FinancialCapabilityUnavailable capability="budgets" />;
}
