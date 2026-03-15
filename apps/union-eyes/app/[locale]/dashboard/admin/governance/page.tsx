export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import GovernanceConsole from './governance-console';

export const metadata: Metadata = {
  title: 'Governance Console | Union Eyes',
  description: 'Golden share, reserved matters, audits, and council elections',
};

export default async function GovernancePage() {
  await requireUser();

  const hasAccess = await hasMinRole("admin");
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <GovernanceConsole />;
}
