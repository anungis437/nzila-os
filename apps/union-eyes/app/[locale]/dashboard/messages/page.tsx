export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MemberMessages } from '@/components/messages/member-messages';
import { requireMemberPage } from '@/lib/dashboard/require-member-page';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ thread?: string; compose?: string }>;
};

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'memberMessages' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/messages — the member's own secure conversations. */
export default async function MessagesPage({ searchParams }: PageProps) {
  await requireMemberPage();
  const { thread, compose } = await searchParams;
  return <MemberMessages initialThreadId={thread} compose={compose === 'privacy' ? 'privacy' : undefined} />;
}
