export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HelpResources } from '@/components/member/help-resources';
import { requireMemberPage } from '@/lib/dashboard/require-member-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberHelp' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/help — guidance and the real paths to the union. */
export default async function HelpPage() {
  await requireMemberPage();
  return <HelpResources />;
}
