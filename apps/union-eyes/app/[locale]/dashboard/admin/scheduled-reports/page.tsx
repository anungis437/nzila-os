'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Scheduled reports administration.
 *
 * Nothing stores a schedule, a recipient or a next run (/api/reports/scheduled answers HTTP 501, and the scheduled_reports
 * table has no authorized runtime access), and nothing would deliver one (the scheduled-reports cron answers HTTP 501
 * too). A list of schedules, or a form that appeared to create one, would promise delivery that cannot happen, so the
 * page says so instead.
 */
export default function ScheduledReportsPage() {
  const t = useTranslations('adminScheduledReportsPage');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <CapabilityUnavailable locale={locale} capability="UE-ANALYTICS-SCHEDULED-REPORTS-UI" />
    </div>
  );
}
