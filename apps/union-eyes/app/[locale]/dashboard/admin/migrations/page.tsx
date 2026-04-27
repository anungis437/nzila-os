/**
 * Admin Migration Observability Dashboard (§1)
 * Server component — auth guard, delegates to client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import MigrationsConsole from '@/components/admin/migrations-console';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMigrationsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AdminMigrationsPage() {
  await requireUser();
  const isAdmin = await hasMinRole('admin');
  if (!isAdmin) redirect('/dashboard');

  return <MigrationsConsole />;
}
