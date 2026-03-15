import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import PensionAdminConsole from '@/components/pension/pension-admin-console';

export const dynamic = 'force-dynamic';

export default async function PensionAdminPage() {
  await requireUser();
  await hasMinRole('steward');

  return <PensionAdminConsole />;
}
