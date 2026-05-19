/**
 * ICRA — Canonical Maturity Model
 *
 * Five bands. Each describes operational reality, governance posture, and
 * continuity implications. Written for executive readers and procurement
 * officers — calm, operational, non-judgmental.
 */
import type { MaturityBand, MaturityBandId } from './types';

export const MATURITY_BANDS: Record<MaturityBandId, MaturityBand> = {
  personality_dependent: {
    id: 'personality_dependent',
    ordinal: 1,
    name: 'Personality Dependent',
    summary:
      'The organization functions through the operational memory and personal authority of a small number of individuals. Continuity is implicit, not institutional.',
    operationalCharacteristics: [
      'Critical decisions rely on the judgement of one or two long-tenured people.',
      'Operational knowledge lives in personal email, notebooks, and informal conversation.',
      'Process documentation, where it exists, is rarely consulted in practice.',
      'New staff onboard primarily by observing key individuals.',
    ],
    governanceImplications: [
      'Board oversight is largely informed by what key personnel choose to surface.',
      'Decision rationale is not consistently recorded outside of meeting outcomes.',
      'Succession is treated as a future concern rather than an active governance discipline.',
    ],
    continuityImplications: [
      'Departure or absence of a single individual can disrupt operational coherence.',
      'Institutional history is at risk of being reinterpreted rather than referenced.',
      'External transitions (audits, regulator visits, leadership change) require heroic effort.',
    ],
    minComposite: 0,
  },
  fragmented_coordination: {
    id: 'fragmented_coordination',
    ordinal: 2,
    name: 'Fragmented Coordination',
    summary:
      'Several teams maintain their own practices, tools, and records. Coordination happens, but the institution does not see itself as a single operational entity.',
    operationalCharacteristics: [
      'Different departments use different tools to record similar information.',
      'Cross-team handoffs depend on relationships more than on procedure.',
      'Operational visibility is limited to whoever has access to the right shared drive.',
      'Reporting requires manual reconciliation across systems.',
    ],
    governanceImplications: [
      'Governance bodies receive inconsistent data depending on who prepares the briefing.',
      'Policy compliance is locally interpreted rather than centrally evidenced.',
      'Audit trails exist but are reconstructed retrospectively.',
    ],
    continuityImplications: [
      'Each transition (role change, vendor change, regulator change) creates avoidable rework.',
      'Operational memory survives at the team level but is fragile at the institutional level.',
      'Strategic continuity depends on individuals translating between fragments.',
    ],
    minComposite: 30,
  },
  structured_governance: {
    id: 'structured_governance',
    ordinal: 3,
    name: 'Structured Governance',
    summary:
      'Governance procedures, policies, and decision logs are formalized. Operational practice is documented and broadly followed.',
    operationalCharacteristics: [
      'Standard operating procedures exist for the majority of recurring operations.',
      'Roles and accountabilities are defined and broadly understood.',
      'Decision logs and minutes are maintained as a routine practice.',
      'Onboarding follows a documented path rather than informal apprenticeship.',
    ],
    governanceImplications: [
      'Boards and oversight bodies operate from consistent, repeatable information.',
      'Policy adherence can be evidenced through documented procedure.',
      'Risk and compliance reporting is structured, even if not yet longitudinal.',
    ],
    continuityImplications: [
      'Individual transitions can be absorbed without operational disruption.',
      'Institutional history is referenceable, though not yet actively analyzed.',
      'Continuity is treated as a discipline, not yet as institutional intelligence.',
    ],
    minComposite: 55,
  },
  continuity_aware: {
    id: 'continuity_aware',
    ordinal: 4,
    name: 'Continuity-Aware',
    summary:
      'The organization treats continuity as a governance discipline. Institutional memory, succession, and operational coherence are actively maintained.',
    operationalCharacteristics: [
      'Operational knowledge is captured in shared systems and reviewed periodically.',
      'Succession plans exist for critical roles and are refreshed routinely.',
      'Transitions trigger structured handover, not informal improvisation.',
      'Cross-team coordination is mediated by explicit, audited mechanisms.',
    ],
    governanceImplications: [
      'Governance bodies receive longitudinal context, not only point-in-time updates.',
      'Decisions are recorded with their rationale and reviewable evidence.',
      'Policy evolution is tracked and explainable across leadership generations.',
    ],
    continuityImplications: [
      'Leadership transitions preserve institutional direction.',
      'Operational memory is durable across role changes and reorganizations.',
      'External scrutiny (audits, regulators) finds a coherent, evidence-backed posture.',
    ],
    minComposite: 75,
  },
  continuity_intelligence: {
    id: 'continuity_intelligence',
    ordinal: 5,
    name: 'Continuity Intelligence',
    summary:
      'Continuity is instrumented. The institution can see its own operational coherence, governance posture, and memory over time, and uses that visibility to inform stewardship.',
    operationalCharacteristics: [
      'Operational and governance signals are continuously observable, not retrospectively reconstructed.',
      'Institutional memory is treated as durable infrastructure and curated as such.',
      'Transitions are anticipated, simulated, and rehearsed.',
      'Cross-organization coordination is governed by explicit, auditable agreements.',
    ],
    governanceImplications: [
      'Governance has direct visibility into operational reality without relying on heroic reporting.',
      'Decisions are accompanied by replayable evidence and explainable rationale.',
      'Strategic direction is continuous across leadership generations.',
    ],
    continuityImplications: [
      'Leadership change does not interrupt institutional direction.',
      'Operational memory becomes an asset that compounds across time.',
      'The institution can engage external scrutiny with calm, evidenced confidence.',
    ],
    minComposite: 90,
  },
};

export const MATURITY_BANDS_ORDERED: MaturityBand[] = (
  Object.values(MATURITY_BANDS) as MaturityBand[]
).sort((a, b) => a.ordinal - b.ordinal);

/**
 * Resolve the band for a composite continuity score.
 * Deterministic, explainable, replayable.
 */
export function resolveMaturityBand(composite: number): MaturityBand {
  const clamped = Math.max(0, Math.min(100, composite));
  let resolved: MaturityBand = MATURITY_BANDS.personality_dependent;
  for (const band of MATURITY_BANDS_ORDERED) {
    if (clamped >= band.minComposite) resolved = band;
  }
  return resolved;
}
