'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { locales, type Locale } from '@/lib/locales';

export function RootLocalePresentation({ initialLocale, staging }: { initialLocale: string; staging: boolean }) {
  const params = useParams();
  const routeLocale = params?.locale;
  const locale = typeof routeLocale === 'string' && locales.includes(routeLocale as Locale) ? routeLocale : initialLocale;

  // The shared server root persists across client locale changes. Keep its
  // document language and environment notice aligned with the active route.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (!staging) return null;
  return (
    <div className="ue-environment-banner border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
      {locale === 'fr-CA' ? 'Environnement de préproduction. Les données et le comportement peuvent changer sans préavis.' : 'Staging environment. Pre-production data and behavior may change without notice.'}
    </div>
  );
}
