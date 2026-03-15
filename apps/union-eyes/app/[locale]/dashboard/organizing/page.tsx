export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { OrganizingConsole } from '@/components/organizing/organizing-console';

export default async function OrganizingDashboardPage() {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  return <OrganizingConsole />;
}
