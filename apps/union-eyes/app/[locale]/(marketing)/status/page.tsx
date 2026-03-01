/**
 * Locale-aware Status page
 * Accessible at /{locale}/status
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StatusPage } from '@/components/monitoring/StatusPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.status' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default function LocaleStatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <StatusPage />
    </div>
  );
}
