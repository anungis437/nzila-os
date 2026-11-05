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

/** The canonical price as public copy: "$1,200 CAD", or "1 200 $ CAD" in Canadian French. */
export function icraPriceLabel(tierId: keyof typeof ICRA_PAID_REPORT_PRICES, french: boolean): string {
  const { amountCents, label } = ICRA_PAID_REPORT_PRICES[tierId];
  if (!french) return label;
  return `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 }).format(amountCents / 100)} $ CAD`;
}
