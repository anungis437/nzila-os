/**
 * SMS Communications Dashboard
 * Server wrapper with auth — delegates to SmsConsole client component
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { SmsConsole } from '@/components/communications/sms-console';

export default async function SmsPage() {
  const _user = await requireUser();
  if (!(await hasMinRole('steward'))) {
    redirect('/dashboard');
  }

  return <SmsConsole />;
}

