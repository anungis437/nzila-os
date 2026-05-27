/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 *
 * Case study coordination surface
 *
 * Coordination posture: representation workflow, case management, intake choreography,
 * and operational coordination across federation, leadership, member, and staff touchpoints.
 *
 * Governance posture: bylaw-aligned procedural cadence, constitutional consistency,
 * accountability surfaces, and compliance choreography across jurisdictions and mandates.
 *
 * Continuity posture: organizational memory preservation, succession-aware handoff,
 * stewardship of representational records, and procedural continuity across mandates.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: 'Case Studies | UnionEyes',
    description:
      'Real labour-organization outcomes using organizational memory and operational coherence — a Canadian-hosted, bilingual-first continuity layer that operates alongside existing systems.',
    alternates: buildLocaleAlternates(locale, '/case-studies'),
  };
}

export default function CaseStudiesLayout({ children }: { children: ReactNode }) {
  return children;
}
