'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Admin financial reports.
 *
 * Nothing generates a dues report or an export in this release: the report routes that used to sit under /api/v2/admin/reports answer
 * HTTP 410 and no replacement exists. The page used to state a collected total, a collection rate, a member count, a payment breakdown by
 * category and a list of earlier reports that no query produced, and its Generate and Export buttons ended in a retired route whose failure was
 * swallowed. The real dues figures are on the dues dashboard (/dashboard/admin/dues), which reads them from the ledger.
 */
export default function ReportsAnalyticsPage() {
  const t = useTranslations('adminDuesReportsPage');
  const locale = useLocale();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-FIN-DUES-REPORTS" />
    </div>
  );
}
