export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/api-auth-guard';
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
  await requireUser();
  // Case standing and the member/staff projection are enforced by the detail API.
  // A member represented in this matter must be able to follow its direct link.

  return <GrievanceDetailConsole />;
}
