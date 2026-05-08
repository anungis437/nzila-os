import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { InstitutionalMemoryExplorer } from '@/components/knowledge-transfer/institutional-memory-explorer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Memory',
  description:
    'Navigate your organization\'s operational knowledge, procedures, and institutional history.',
};

export default async function InstitutionalMemoryPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <InstitutionalMemoryExplorer />;
}
