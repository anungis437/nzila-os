export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { GrievancesConsole } from '@/components/grievances/grievances-console';
import { Cupe4373GrievancesPage } from '@/components/demo/cupe4373-grievances-page';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';

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

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole('steward') : true;
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  if (isCupe4373DemoRuntime()) {
    return <Cupe4373GrievancesPage locale={locale} />;
  }

  return <GrievancesConsole />;
}
