export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MemberPrivacy } from '@/components/member/member-privacy';
import { requireMemberPage } from '@/lib/dashboard/require-member-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberPrivacy' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/privacy — how the member's information is used and how to make a request. */
export default async function PrivacyPage() {
  await requireMemberPage();
  return <MemberPrivacy />;
}
