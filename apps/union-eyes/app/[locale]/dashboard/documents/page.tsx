export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/api-auth-guard';
import { DocumentsConsole } from '@/components/documents/documents-console';
import { Cupe4373DocumentsPage } from '@/components/demo/cupe4373-documents-page';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'documentsPage' });
  return {
    title: t('header.title'),
    description: t('header.description'),
  };
}

export default async function DocumentsPage({ params }: PageProps) {
  const { locale } = await params;
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }

  if (isCupe4373DemoRuntime()) {
    return <Cupe4373DocumentsPage locale={locale} />;
  }

  return <DocumentsConsole />;
}
