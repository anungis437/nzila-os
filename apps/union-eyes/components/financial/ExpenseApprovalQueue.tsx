'use client';

import FinancialCapabilityUnavailable from './FinancialCapabilityUnavailable';

interface ExpenseApprovalQueueProps {
  organizationId?: string | null;
}

/** Expense approval has no qualified record store; see FinancialCapabilityUnavailable. */
export default function ExpenseApprovalQueue(_props: ExpenseApprovalQueueProps) {
  return <FinancialCapabilityUnavailable capability="expenses" />;
}
