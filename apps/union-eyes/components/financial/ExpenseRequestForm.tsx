'use client';

import FinancialCapabilityUnavailable from './FinancialCapabilityUnavailable';

interface ExpenseRequestFormProps {
  budgetId?: string;
  onSuccess?: () => void;
}

/** Expense submission has no qualified record store; see FinancialCapabilityUnavailable. */
export default function ExpenseRequestForm(_props: ExpenseRequestFormProps) {
  return <FinancialCapabilityUnavailable capability="expenses" />;
}
