/**
 * Admin Migration Observability Dashboard (§1)
 * Server component — auth guard, delegates to client console.
 */
export const dynamic = 'force-dynamic';

import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import MigrationsConsole from '@/components/admin/migrations-console';

export default async function AdminMigrationsPage() {
  await requireUser();
  const isAdmin = await hasMinRole('admin');
  if (!isAdmin) redirect('/dashboard');

  return <MigrationsConsole />;
}
