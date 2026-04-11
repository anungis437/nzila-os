export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { TargetsConsole } from '@/components/targets/targets-console';
import { checkModuleEntitlement } from '@/services/platform-economics/entitlement-guard';

export default async function TargetsPage() {
  const user = await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  // Premium feature — not available in pilot
  const entitlement = await checkModuleEntitlement(user.organizationId, 'performance_targets');
  if (!entitlement.allowed) {
    redirect('/dashboard');
  }

  return (
    <main className="p-6 md:p-10">
      <TargetsConsole />
    </main>
  );
} 
