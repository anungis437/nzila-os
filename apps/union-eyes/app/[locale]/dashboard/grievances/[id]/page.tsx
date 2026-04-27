export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { GrievanceDetailConsole } from '@/components/grievances/grievance-detail-console';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'grievanceDetailPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function GrievanceDetailPage() {
  const _user = await requireUser();
  const allowed = await hasMinRole('steward');
  if (!allowed) redirect(`/dashboard`);

  return <GrievanceDetailConsole />;
}
