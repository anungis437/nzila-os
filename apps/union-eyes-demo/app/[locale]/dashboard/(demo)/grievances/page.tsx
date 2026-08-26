export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/api-auth-guard';
import { Cupe4373GrievancesPage } from '@/components/demo/cupe4373-grievances-page';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'grievancesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function GrievancesPage({ params }: PageProps) {
  const { locale } = await params;
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  // Demo build: every authenticated user sees the demo grievances page.
  // No operational RBAC gating and no operational fallback exists here.
  return <Cupe4373GrievancesPage locale={locale} />;
}
