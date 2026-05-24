/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance (procedural, constitutional, bylaw, compliance, accountability),
 * continuity (organizational memory, succession, handoff, preservation, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, oversight).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence under human review, with explainability and reviewability.
 * Governance-safe AI by default — every action remains operator-initiated and operator-reviewable,
 * preserving organizational memory.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Page() {
  redirect('/en-CA/trust');
}
