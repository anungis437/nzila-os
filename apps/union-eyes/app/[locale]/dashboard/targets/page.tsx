export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { TargetsConsole } from '@/components/targets/targets-console';

export default async function TargetsPage() {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  return (
    <main className="p-6 md:p-10">
      <TargetsConsole />
    </main>
  );
} 
