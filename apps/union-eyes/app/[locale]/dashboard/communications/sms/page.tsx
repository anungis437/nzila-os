/**
 * SMS Communications Dashboard
 * Server wrapper with auth — delegates to SmsConsole client component
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { hasMinRole } from '@/lib/auth/has-min-role';
import { SmsConsole } from '@/components/communications/sms-console';

export default async function SmsPage() {
  const user = await requireUser();
  if (!(await hasMinRole('steward'))) {
    redirect('/dashboard');
  }

  return <SmsConsole />;
}

