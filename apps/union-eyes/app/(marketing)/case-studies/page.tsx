/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * institutional trust for democratic infrastructure.
 *
 * Case study coordination surface
 *
 * Coordination posture: representation workflow, case management, intake choreography,
 * and operational coordination across federation, leadership, member, and staff touchpoints.
 *
 * Governance posture: bylaw-aligned procedural cadence, constitutional consistency,
 * accountability surfaces, and compliance choreography across jurisdictions and mandates.
 *
 * Continuity posture: institutional memory preservation, succession-aware handoff,
 * stewardship of representational records, and procedural continuity across mandates.
 */
import { notFound } from 'next/navigation';
import { CASE_STUDIES_VISIBLE } from '@/lib/marketing-feature-flags';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (!CASE_STUDIES_VISIBLE) {
    notFound();
  }
  // Re-enable redirect once CASE_STUDIES_VISIBLE flips back to true.
  notFound();
}
