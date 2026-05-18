export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CasesConsole } from '@/components/cases/cases-console';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'casesPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CasesPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  const hasAccess = await hasMinRole('steward');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <CasesConsole />;
}
