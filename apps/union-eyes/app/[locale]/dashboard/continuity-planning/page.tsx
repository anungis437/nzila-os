import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuityPlanningWorkspace } from '@/components/knowledge-transfer/continuity-planning-workspace';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION } from '@nzila/institutional-governance-graph';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Planning',
  description:
    'Reviewer-led institutional continuity planning workspace with explainable reasoning, resilience pathways, and traceable action chronology. Assistive · human-reviewed · review-required.',
};

export default async function ContinuityPlanningPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <ContinuityPlanningWorkspace />
      <RuntimeHydrationFooter
        surface="Continuity Planning"
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
            'Reviewer-led planning surface backed by the continuity substrate. All proposed actions are projected as drafts and require human ratification — no autonomous governance, no scoring.',
          reviewPosture: 'assistive · human-reviewed · review-required',
        }}
      />
    </>
  );
}
