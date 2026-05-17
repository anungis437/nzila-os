import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { ContinuityIntelligenceCockpit } from '@/components/knowledge-transfer/continuity-intelligence-cockpit';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION } from '@nzila/institutional-governance-graph';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Continuity Intelligence',
  description:
    'Reviewer-assisted institutional continuity surface: continuity fragility signals, expertise continuity lineage, succession readiness, and chronology-aware continuity context. Assistive · human-reviewed · review-required.',
};

export default async function ContinuityIntelligencePage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <ContinuityIntelligenceCockpit />
      <RuntimeHydrationFooter
        surface="Continuity Intelligence"
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
            'Projected from the institutional continuity layer (governance/continuity.ts) after protected-semantics redaction. Continuity signals are presented as stewardship context — not as governance recommendations, scores, or predictions.',
          reviewPosture: 'assistive · human-reviewed · review-required',
        }}
      />
    </>
  );
}
