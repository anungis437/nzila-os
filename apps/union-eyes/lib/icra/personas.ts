/**
 * ARTIFACT TYPE: Executive Persona Adaptation
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * ICRA Executive Persona System — maps organizational context to executive
 * persona types, enabling the insight engine to adapt copy for operational
 * environments that differ meaningfully.
 *
 * Each persona should feel: "This understands our environment."
 * Not: "We have been categorized."
 *
 * Personas are detected, not declared. The user never sees them directly.
 */

import type { ExecutivePersonaId, OrganizationContext } from './types';

export interface PersonaDefinition {
  id: ExecutivePersonaId;
  label: string;
  environment: string;
  operationalConcerns: [string, string, string];
}

export const PERSONAS: Record<ExecutivePersonaId, PersonaDefinition> = {
  executive_director: {
    id: 'executive_director',
    label: 'Executive Director',
    environment: 'Non-profit, association, or mission-driven organization',
    operationalConcerns: [
      'Organizational stability through leadership and board transitions',
      'Turnover risk and organizational knowledge preservation',
      'Governance consistency across changing leadership generations',
    ],
  },
  union_leadership: {
    id: 'union_leadership',
    label: 'Union Leadership',
    environment: 'Labour union, local, federation, or council',
    operationalConcerns: [
      'Precedent continuity across grievance cycles and leadership transitions',
      'Operational fairness and consistent application of collective agreement',
      'Governance coherence through officer elections and representative transitions',
    ],
  },
  healthcare_ops: {
    id: 'healthcare_ops',
    label: 'Healthcare Operations Leadership',
    environment: 'Healthcare institution, social services, or care organization',
    operationalConcerns: [
      'Onboarding continuity and organizational orientation for clinical and operational staff',
      'Continuity burden on staff compensating for fragmented systems',
      'Operational fragmentation across units, facilities, or care settings',
    ],
  },
  cio_coo: {
    id: 'cio_coo',
    label: 'CIO / COO',
    environment: 'Technology and operational leadership in any organizational context',
    operationalConcerns: [
      'Modernization risk — preserving organizational context during technology transitions',
      'Operational fragmentation across platforms, systems, and vendors',
      'Governance traceability and audit readiness during infrastructure change',
    ],
  },
  governance_board: {
    id: 'governance_board',
    label: 'Board / Governance Leadership',
    environment: 'Governing board, oversight committee, or governance body',
    operationalConcerns: [
      'Organizational resilience and continuity across board composition changes',
      'Accountability and governance visibility into operational reality',
      'Continuity stewardship as a governance discipline',
    ],
  },
  federated_org: {
    id: 'federated_org',
    label: 'Federated Organization',
    environment: 'Federation, national body, or multi-unit organization',
    operationalConcerns: [
      'Continuity coherence across federated units or locals with varying maturity',
      'Organizational memory preservation at the federation level across affiliate transitions',
      'Governance consistency in federated structures with distributed authority',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Persona detection — inferred from organizational context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the most likely executive persona from organizational context.
 * Returns the best match based on org type and sector signals.
 * Defaults to governance_board — the safest organizational default.
 */
export function detectPersona(context: OrganizationContext): ExecutivePersonaId {
  const sector = context.sector?.toLowerCase() ?? '';
  const govModel = context.governanceModel ?? '';
  const federation = context.federationAffiliation;

  // Federation signal overrides sector
  if (federation || sector.includes('federation') || sector.includes('council'))
    return 'federated_org';

  if (sector === 'healthcare') return 'healthcare_ops';

  // Union types map to union_leadership
  if (
    sector === 'public_sector' &&
    (govModel === 'elected_board' || govModel === 'hybrid')
  )
    return 'union_leadership';

  // CIO/COO pattern: private sector with appointed board
  if (sector === 'private_sector' && govModel === 'appointed_board')
    return 'cio_coo';

  // Non-profit / association → executive director
  if (
    sector === 'nonprofit' ||
    sector === 'association' ||
    sector === 'education'
  )
    return 'executive_director';

  // Elected board with no other strong signal → union or governance board
  if (govModel === 'elected_board') return 'union_leadership';

  return 'governance_board';
}

export function getPersonaLabel(id: ExecutivePersonaId): string {
  return PERSONAS[id].label;
}

export function getPersonaConcerns(id: ExecutivePersonaId): [string, string, string] {
  return PERSONAS[id].operationalConcerns;
}

export function getPersonaEnvironment(id: ExecutivePersonaId): string {
  return PERSONAS[id].environment;
}
