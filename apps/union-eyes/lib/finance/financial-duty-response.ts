import { NextResponse } from 'next/server';
import { FinancialDutyError } from '@/lib/authority/store/finance-route-adapter';

/**
 * The HTTP answer for a refused financial duty, or null for any other error. 501 carries the exact columns the payments
 * source lacks; no 2xx payload ever stands in for an unavailable or refused duty.
 */
export function financialDutyErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FinancialDutyError)) return null;
  const unavailable = error.code === 'FINANCE_SOURCE_UNAVAILABLE';
  return NextResponse.json(
    {
      success: false,
      error: { code: error.code, message: error.message },
      ...(error.reasons.length > 0 ? { reasons: error.reasons } : {}),
      ...(unavailable ? { capabilityState: 'UNAVAILABLE', missingColumns: error.missingColumns } : {}),
    },
    { status: error.status },
  );
}
