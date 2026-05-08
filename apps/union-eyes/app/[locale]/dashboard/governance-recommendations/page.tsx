import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { GovernanceRecommendationsWorkspace } from '@/components/knowledge-transfer/governance-recommendations-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governance Recommendations',
  description:
    'Evidence-grounded governance recommendation review workspace. Approve, defer, or reject organizational continuity recommendations with full reasoning transparency.',
};

export default async function GovernanceRecommendationsPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <GovernanceRecommendationsWorkspace />;
}
