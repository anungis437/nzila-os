export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MyUnion } from '@/components/member/my-union';
import { requireMemberPage } from '@/lib/dashboard/require-member-page';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'myUnion' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/union — membership identity and services. */
export default async function MyUnionPage() {
  await requireMemberPage();
  return <MyUnion />;
}
