import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PensionMemberConsole from '@/components/pension/pension-member-console';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pensionMemberPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PensionDashboard() {
  await requireUser();
  await hasMinRole('member');

  return <PensionMemberConsole />;
}
