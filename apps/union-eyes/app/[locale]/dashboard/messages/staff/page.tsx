export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StaffMessages } from '@/components/messages/staff-messages';
import { requireStaffMessagesPage } from '@/lib/messaging/require-staff-messages-page';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ thread?: string }>;
};

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'staffMessages' });
  return { title: t('title'), description: t('description') };
}

/** /dashboard/messages/staff — the triage queue and the conversations assigned to the signed-in staff member. */
export default async function StaffMessagesPage({ searchParams }: PageProps) {
  const { userId } = await requireStaffMessagesPage();
  const { thread } = await searchParams;
  return <StaffMessages userId={userId} initialThreadId={thread} />;
}
