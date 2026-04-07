export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { GrievancesConsole } from '@/components/grievances/grievances-console';

export default async function GrievancesPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login');
  }
  const allowed = await hasMinRole('steward');
  if (!allowed) redirect('/dashboard');

  return <GrievancesConsole />;
}
