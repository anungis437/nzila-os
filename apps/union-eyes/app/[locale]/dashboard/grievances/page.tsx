export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/api-auth-guard';
import { isCaseHandlerRole } from '@/lib/cases/case-role-access';
import { GrievancesConsole } from '@/components/grievances/grievances-console';

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

export default async function GrievancesPage() {
  let currentUser;
  try {
    currentUser = await requireUser();
  } catch {
    redirect('/login');
  }

  const handlerRole = currentUser.roles.find(isCaseHandlerRole);
  if (!handlerRole) {
    redirect('/dashboard');
  }

  return <GrievancesConsole />;
}
