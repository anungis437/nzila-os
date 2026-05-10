/**
 * Locale-aware For Members page.
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
  const t = await getTranslations({ locale, namespace: 'marketing.rolePages.members' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/for-members'),
  };
}

export default async function LocaleForMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LocaleRolePageContent role="members" locale={locale} />;
}
