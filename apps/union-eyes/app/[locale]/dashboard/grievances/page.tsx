export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { hasMinRole } from '@/lib/auth/has-min-role';
import { GrievancesConsole } from '@/components/grievances/grievances-console';

export default async function GrievancesPage() {
  const user = await requireUser();
  const allowed = await hasMinRole('steward');
  if (!allowed) redirect(`/dashboard`);

  return <GrievancesConsole />;
}
