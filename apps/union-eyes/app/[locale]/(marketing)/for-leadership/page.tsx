/**
 * Locale-aware For Leadership page.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import LocaleRolePageContent from '../locale-role-page-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.rolePages.leadership' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/for-leadership'),
  };
}

export default async function LocaleForLeadershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LocaleRolePageContent role="leadership" locale={locale} />;
}
