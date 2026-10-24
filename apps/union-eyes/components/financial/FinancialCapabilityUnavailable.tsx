'use client';

import { useTranslations } from 'next-intl';

export type UnavailableFinancialCapability =
  | 'budgets'
  | 'expenses'
  | 'vendors'
  | 'strikeFunds'
  | 'affiliateRemittances';

/**
 * Honest placeholder for union-finance capabilities that have no qualified
 * authoritative record store. Renders no data and no actions.
 */
export default function FinancialCapabilityUnavailable({
  capability,
}: {
  capability: UnavailableFinancialCapability;
}) {
  const t = useTranslations('financialCapabilityUnavailable');
  return (
    <section
      role="status"
      aria-live="polite"
      data-capability-state="NOT_IMPLEMENTED"
      className="mx-auto max-w-2xl rounded-lg border bg-muted/40 p-6 text-center"
    >
      <h2 className="mb-1 text-lg font-semibold">{t(capability)}</h2>
      <p className="mb-3 text-sm font-medium text-muted-foreground">{t('state')}</p>
      <p className="text-sm text-muted-foreground">{t('explanation')}</p>
    </section>
  );
}
