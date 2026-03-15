export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { hasMinRole } from '@/lib/auth/has-min-role';
import { GrievanceDetailConsole } from '@/components/grievances/grievance-detail-console';

export default async function GrievanceDetailPage() {
  const user = await requireUser();
  const allowed = await hasMinRole('steward');
  if (!allowed) redirect(`/dashboard`);

  return <GrievanceDetailConsole />;
}
