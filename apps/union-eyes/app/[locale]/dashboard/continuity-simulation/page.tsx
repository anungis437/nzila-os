import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuitySimulationWorkspace } from '@/components/knowledge-transfer/continuity-simulation-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Simulation',
  description:
    'Interactive workspace to explore organizational continuity fragility, simulate disruption scenarios, and compare mitigation strategies.',
};

export default async function ContinuitySimulationPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <ContinuitySimulationWorkspace />;
}
