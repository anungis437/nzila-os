export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InboxConsole } from '@/components/inbox/inbox-console';

export const metadata: Metadata = {
  title: 'Inbox | UnionEyes',
  description: 'Unified signal feed — messages, cases, and notifications.',
};

export default function InboxPage() {
  // Auth is enforced by the dashboard layout; InboxConsole's API calls also gate access.
  // Repeating requireUser() here crashes the RSC stream during client-side navigation.
  return (
    <Suspense fallback={null}>
      <InboxConsole />
    </Suspense>
  );
}
