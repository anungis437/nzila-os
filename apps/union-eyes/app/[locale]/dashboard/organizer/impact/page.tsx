'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

export const dynamic = 'force-dynamic';

/**
 * Organizer impact dashboard.
 *
 * The route that was meant to feed it, /api/organizer/impact, answers HTTP 501: no impact is measured anywhere (the
 * organizer task rows it once returned were not impact figures). The page says so instead of the "no impact data yet"
 * empty state, which would read as a real, empty result.
 */
export default function OrganizerImpactPage() {
  const t = useTranslations('organizerImpactPage');
  const locale = useLocale();

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
        <CapabilityUnavailable locale={locale} capability="UE-ORGANIZER-IMPACT" />
      </div>
    </div>
  );
}
