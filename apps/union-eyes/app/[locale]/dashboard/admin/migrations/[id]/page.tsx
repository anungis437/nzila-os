/**
 * Admin Migration Detail View (§2)
 * Server component — auth guard + batch ID param, delegates to client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import MigrationDetailConsole from '@/components/admin/migration-detail-console';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminMigrationDetailPage({ params }: Props) {
  await requireUser();
  const isAdmin = await hasMinRole('admin');
  if (!isAdmin) redirect('/dashboard');

  const { id } = await params;
  return <MigrationDetailConsole batchId={id} />;
}
