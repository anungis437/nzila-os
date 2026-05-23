import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { InstitutionalMemoryExplorer } from '@/components/knowledge-transfer/institutional-memory-explorer';
import { RuntimeHydrationFooter } from '@/components/runtime-hydration';
import { CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION } from '@nzila/institutional-governance-graph';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Institutional Memory',
  description:
    'Navigate your institution\'s preserved context, procedural lineage, and continuity-aware records. Assistive · human-reviewed · review-required.',
};

export default async function InstitutionalMemoryPage() {
  const user = await requireUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <InstitutionalMemoryExplorer />
      <RuntimeHydrationFooter
        surface="Institutional Memory"
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
            'Projected from the institutional governance graph via the protected-semantics fence (redactProtected → assertNoProtectedKindsInReadSurface). Preserved context, lineage, and continuity records only — no behavioural or predictive content.',
          reviewPosture: 'inspectable · read-only · provenance-stamped',
        }}
      />
    </>
  );
}
