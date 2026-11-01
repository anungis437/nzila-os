/** Canonical published ICRA report prices, shared by checkout and public copy.
 * Changing a price is a commercial decision; the checkout also verifies
 * every configured Stripe Price against this amount before payment.
 */
import type { ReportTierId } from './types';

type PaidReportTierId = Exclude<ReportTierId, 'continuity_reflection'>;

export const ICRA_PAID_REPORT_PRICES = {
  executive_continuity_brief: { amountCents: 120000, currency: 'cad', label: '$1,200 CAD' },
  institutional_continuity_diagnostic: { amountCents: 650000, currency: 'cad', label: '$6,500 CAD' },
} as const satisfies Record<PaidReportTierId, { amountCents: number; currency: 'cad'; label: string }>;
