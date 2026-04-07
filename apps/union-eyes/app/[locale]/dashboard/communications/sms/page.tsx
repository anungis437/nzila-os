/**
 * SMS Communications Dashboard
 * Client component — auth handled by dashboard layout (consistent with
 * campaigns/page.tsx and templates/page.tsx).
 *
 * Previously this was a server component that ran requireUser() +
 * hasMinRole('steward') before rendering SmsConsole.  The redundant
 * server-side auth caused a flash-then-redirect on client navigation
 * whenever the org/role lookup couldn't resolve in time.
 */

'use client';

export const dynamic = 'force-dynamic';

import { SmsConsole } from '@/components/communications/sms-console';

export default function SmsPage() {
  return <SmsConsole />;
}

