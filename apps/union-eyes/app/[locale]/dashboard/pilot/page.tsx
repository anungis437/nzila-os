export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import PilotDashboard from './pilot-dashboard';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pilotPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function PilotDashboardPage() {
  await requireUser();

  const hasAccess = await hasMinRole('officer');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <PilotDashboard />;
}
