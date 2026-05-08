import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { InstitutionalIntelligenceWorkspace } from '@/components/knowledge-transfer/institutional-intelligence-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Intelligence',
  description:
    'Adaptive organizational cognition and federated governance intelligence. Understand how your organization learns, adapts, and evolves continuity over time.',
};

export default async function InstitutionalIntelligencePage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <InstitutionalIntelligenceWorkspace />;
}
