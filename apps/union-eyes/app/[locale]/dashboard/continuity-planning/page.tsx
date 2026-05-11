import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuityPlanningWorkspace } from '@/components/knowledge-transfer/continuity-planning-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Planning',
  description:
    'Prioritized organizational continuity planning workspace with transparent decision intelligence, resilience roadmap, and action tracking.',
};

export default async function ContinuityPlanningPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <ContinuityPlanningWorkspace />;
}
