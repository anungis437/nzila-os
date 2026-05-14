import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { InstitutionalMemoryExplorer } from '@/components/knowledge-transfer/institutional-memory-explorer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Memory',
  description:
    'Navigate your institution\'s preserved context, procedural lineage, and continuity-aware records.',
};

export default async function InstitutionalMemoryPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <InstitutionalMemoryExplorer />;
}
