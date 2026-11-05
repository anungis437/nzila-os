export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MemberPreferences } from '@/components/member/member-preferences';
import { requireMemberPage } from '@/lib/dashboard/require-member-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberPreferences' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/preferences — notification preferences that take effect server-side. */
export default async function PreferencesPage() {
  await requireMemberPage();
  return <MemberPreferences />;
}
