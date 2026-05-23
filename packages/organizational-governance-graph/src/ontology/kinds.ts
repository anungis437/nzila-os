/**
 * Institutional Governance Graph — Ontology Kinds
 *
 * Local constants for IGG-specific entities, relationships, and events.
 *
 * RATIONALE: The canonical `@nzila/platform-ontology` registry currently
 * exposes a fixed enum (`OntologyEntityType`, `RelationshipType`) that does
 * not include institutional-governance kinds (congress, federation, union,
 * local, bargaining_unit, steward, etc.). Modifying that registry is a
 * substrate change and is out of scope for this phase.
 *
 * Phase 3 should migrate these constants into the central registry. Until
 * then we keep them namespaced under `igg:` and surface them via
 * `EntityNode.metadata.iggKind` / `EntityEdge.metadata.iggKind` so that
 * downstream consumers can read them without a substrate change.
 */

// ── Entity kinds ────────────────────────────────────────────────────────────

export const IggEntityKinds = {
  PLATFORM: 'igg:platform',
  CONGRESS: 'igg:congress',
  FEDERATION: 'igg:federation',
  UNION: 'igg:union',
  LOCAL: 'igg:local',
  REGION: 'igg:region',
  DISTRICT: 'igg:district',
  EMPLOYER: 'igg:employer',
  WORKSITE: 'igg:worksite',
  BARGAINING_UNIT: 'igg:bargaining_unit',
  COMMITTEE: 'igg:committee',
  MEMBER: 'igg:member',
  STEWARD: 'igg:steward',
  LRO: 'igg:lro',
  NATIONAL_REP: 'igg:national_rep',
  OFFICER: 'igg:officer',
  NEGOTIATOR: 'igg:negotiator',
  UMRC: 'igg:umrc',
  CLASS_B_SPECIAL_VOTING_SHARE: 'igg:class_b_special_voting_share',
  RESERVED_MATTER: 'igg:reserved_matter',
  BYLAW: 'igg:bylaw',
  CBA: 'igg:cba',
  MOTION: 'igg:motion',
  PROPOSAL: 'igg:proposal',
  DECISION: 'igg:decision',
  EVIDENCE: 'igg:evidence',
  AUDIT_ENTRY: 'igg:audit_entry',
} as const

export type IggEntityKind = (typeof IggEntityKinds)[keyof typeof IggEntityKinds]

// ── Relationship kinds ──────────────────────────────────────────────────────

export const IggRelationshipKinds = {
  PARENT_OF: 'igg:parent_of',
  AFFILIATED_WITH: 'igg:affiliated_with',
  REPRESENTS: 'igg:represents',
  MEMBER_OF: 'igg:member_of',
  BARGAINS_FOR: 'igg:bargains_for',
  NEGOTIATES: 'igg:negotiates',
  SUPERSEDES: 'igg:supersedes',
  ELIGIBLE_TO_VOTE_IN: 'igg:eligible_to_vote_in',
  DELEGATES_TO: 'igg:delegates_to',
  CASTS: 'igg:casts',
  HOLDS: 'igg:holds',
  VETOES: 'igg:vetoes',
  APPROVES: 'igg:approves',
  TENURED_AS: 'igg:tenured_as',
  GOVERNED_BY: 'igg:governed_by',
  DEPENDS_ON: 'igg:depends_on',
  OVERRIDES: 'igg:overrides',
  ESCALATED_TO: 'igg:escalated_to',
  TRIGGERED_BY: 'igg:triggered_by',
  INFORMED_BY: 'igg:informed_by',
} as const

export type IggRelationshipKind =
  (typeof IggRelationshipKinds)[keyof typeof IggRelationshipKinds]

// ── Event kinds ─────────────────────────────────────────────────────────────

export const IggEventKinds = {
  AFFILIATION_TRANSITION: 'igg:affiliation_transition',
  STEWARD_ASSIGNMENT: 'igg:steward_assignment',
  ROLE_TENURE_EVENT: 'igg:role_tenure_event',
  VOTING_SESSION_OPENED: 'igg:voting_session_opened',
  VOTING_SESSION_CLOSED: 'igg:voting_session_closed',
  ELIGIBILITY_SET: 'igg:eligibility_set',
  DELEGATION_DECLARED: 'igg:delegation_declared',
  VOTE_CAST: 'igg:vote_cast',
  MOTION_OUTCOME: 'igg:motion_outcome',
  NEGOTIATION_SESSION: 'igg:negotiation_session',
  PROPOSAL_EXCHANGED: 'igg:proposal_exchanged',
  CBA_RATIFIED: 'igg:cba_ratified',
  RESERVED_MATTER_RAISED: 'igg:reserved_matter_raised',
  CLASS_B_VETO: 'igg:class_b_veto',
  GOLDEN_SHARE_SUNSET_PROGRESSION: 'igg:golden_share_sunset_progression',
  PROTOCOL_AMENDMENT: 'igg:protocol_amendment',
} as const

export type IggEventKind = (typeof IggEventKinds)[keyof typeof IggEventKinds]

// ── Substrate placeholder mapping ───────────────────────────────────────────

/**
 * The canonical entity-graph requires an `OntologyEntityType` from the fixed
 * enum. Until Phase 3 registry expansion, IGG entities are projected as the
 * closest semantic match (`Organization` for institutional bodies, `Member`
 * for natural persons, `Decision` for governance decisions) and the precise
 * IGG kind is preserved in `metadata.iggKind`.
 */
export const SUBSTRATE_KIND_FALLBACK = {
  organization: 'Organization' as const,
  person: 'Member' as const,
  decision: 'Decision' as const,
  document: 'Document' as const,
  evidence: 'EvidencePack' as const,
  audit: 'AuditEvent' as const,
}

/**
 * Map an IGG entity kind to its substrate `OntologyEntityType` placeholder.
 */
export function substrateTypeFor(kind: IggEntityKind): 'Organization' | 'Member' | 'Decision' | 'Document' | 'EvidencePack' | 'AuditEvent' {
  switch (kind) {
    case IggEntityKinds.MEMBER:
    case IggEntityKinds.STEWARD:
    case IggEntityKinds.LRO:
    case IggEntityKinds.NATIONAL_REP:
    case IggEntityKinds.OFFICER:
    case IggEntityKinds.NEGOTIATOR:
      return 'Member'
    case IggEntityKinds.MOTION:
    case IggEntityKinds.PROPOSAL:
    case IggEntityKinds.DECISION:
      return 'Decision'
    case IggEntityKinds.BYLAW:
    case IggEntityKinds.CBA:
      return 'Document'
    case IggEntityKinds.EVIDENCE:
      return 'EvidencePack'
    case IggEntityKinds.AUDIT_ENTRY:
      return 'AuditEvent'
    default:
      return 'Organization'
  }
}

/**
 * The substrate `RelationshipType` enum is also fixed. We map IGG
 * relationship kinds to the closest substrate kind and preserve the precise
 * kind in `metadata.iggKind`.
 */
export function substrateRelationshipFor(
  kind: IggRelationshipKind,
): 'PARENT_OF' | 'CHILD_OF' | 'BELONGS_TO' | 'HAS' | 'REFERENCES' | 'LINKS_TO' | 'DEPENDS_ON' | 'ASSIGNED_TO' | 'APPROVED_BY' {
  switch (kind) {
    case IggRelationshipKinds.PARENT_OF:
      return 'PARENT_OF'
    case IggRelationshipKinds.MEMBER_OF:
    case IggRelationshipKinds.AFFILIATED_WITH:
    case IggRelationshipKinds.GOVERNED_BY:
      return 'BELONGS_TO'
    case IggRelationshipKinds.REPRESENTS:
    case IggRelationshipKinds.BARGAINS_FOR:
    case IggRelationshipKinds.NEGOTIATES:
      return 'ASSIGNED_TO'
    case IggRelationshipKinds.APPROVES:
      return 'APPROVED_BY'
    case IggRelationshipKinds.DEPENDS_ON:
    case IggRelationshipKinds.TRIGGERED_BY:
    case IggRelationshipKinds.INFORMED_BY:
      return 'DEPENDS_ON'
    case IggRelationshipKinds.SUPERSEDES:
    case IggRelationshipKinds.OVERRIDES:
    case IggRelationshipKinds.ESCALATED_TO:
    case IggRelationshipKinds.VETOES:
      return 'REFERENCES'
    case IggRelationshipKinds.HOLDS:
    case IggRelationshipKinds.TENURED_AS:
      return 'HAS'
    case IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN:
    case IggRelationshipKinds.DELEGATES_TO:
    case IggRelationshipKinds.CASTS:
      return 'LINKS_TO'
    default:
      return 'REFERENCES'
  }
}
