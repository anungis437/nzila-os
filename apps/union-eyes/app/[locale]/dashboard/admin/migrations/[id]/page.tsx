/**
 * Admin Migration Detail View (§2)
 * Server component — auth guard + batch ID param, delegates to client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import MigrationDetailConsole from '@/components/admin/migration-detail-console';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminMigrationDetailPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AdminMigrationDetailPage({ params }: Props) {
  await requireUser();
  const isAdmin = await hasMinRole('admin');
  if (!isAdmin) redirect('/dashboard');

  const { id } = await params;
  return <MigrationDetailConsole batchId={id} />;
}
