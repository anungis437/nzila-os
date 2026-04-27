/**
 * Locale-aware For Federations page.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import LocaleRolePageContent from '../locale-role-page-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.rolePages.federations' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

export default async function LocaleForFederationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LocaleRolePageContent role="federations" locale={locale} />;
}
