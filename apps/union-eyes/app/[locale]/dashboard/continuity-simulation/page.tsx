import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuitySimulationWorkspace } from '@/components/knowledge-transfer/continuity-simulation-workspace';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION } from '@nzila/institutional-governance-graph';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Simulation',
  description:
    'Reviewer-led workspace to explore institutional continuity fragility, simulate disruption scenarios, and compare continuity safeguard strategies. Assistive · human-reviewed · review-required.',
};

export default async function ContinuitySimulationPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <ContinuitySimulationWorkspace />
      <RuntimeHydrationFooter
        surface="Continuity Simulation"
        provenance={{
          sourceAdapter: 'institutional-governance-graph/adapters/topology-source-adapter',
          substrateVersion: CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION,
          contractVersion: 'igg.continuity.v1',
        }}
        continuity={{}}
        chronology={{}}
        topology={{}}
        explainability={{
          visibilityRationale:
            'Disruption-scenario projections derived from the continuity substrate. Scenarios are exploratory and reviewer-driven \u2014 no autonomous governance, no scoring, no forecasting.',
          reviewPosture: 'assistive · human-reviewed · review-required',
        }}
      />
    </>
  );
}
