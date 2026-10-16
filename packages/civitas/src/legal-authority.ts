/**
 * Legal-authority substrate.
 *
 * This is not a reasoning engine. Relations are recorded only when supplied.
 * Dates are recorded only when supplied. Chronology does not create a relation,
 * a status, or a winner.
 *
 * DecisionAuthority in @nzila/decision-core is not used here. That type is
 * permission scope for who may decide or execute. Legal authority is which
 * source supports a proposition.
 */
import type { EvidenceRef } from '@nzila/platform-decision-engine/types'

import type { EvidenceTier } from './evidence'

export const LEGAL_SOURCE_CLASSES = [
  'PRIMARY_BINDING',
  'OFFICIAL_INTERPRETATION',
  'PERSUASIVE_PROFESSIONAL',
  'DISCOVERY',
] as const

export type LegalSourceClass = (typeof LEGAL_SOURCE_CLASSES)[number]

export const LEGAL_STATUSES = [
  'CURRENT',
  'AMENDED',
  'REPEALED',
  'SUPERSEDED',
  'OVERRULED',
  'PARTIALLY_OVERRULED',
  'UNKNOWN',
] as const

export type LegalStatus = (typeof LEGAL_STATUSES)[number]

export const AUTHORITY_WEIGHTS = [
  'BINDING',
  'PERSUASIVE',
  'INTERPRETIVE',
  'DISCOVERY_ONLY',
] as const

export type AuthorityWeight = (typeof AUTHORITY_WEIGHTS)[number]

export const AUTHORITY_RELATIONS = [
  'SUPPORTS',
  'CONTRADICTS',
  'INTERPRETS',
  'LIMITS',
  'DISTINGUISHES',
  'AMENDS',
  'REPEALS',
  'SUPERSEDES',
  'AFFIRMS',
  'REVERSES',
] as const

export type AuthorityRelation = (typeof AUTHORITY_RELATIONS)[number]

export const CLAIM_STATES = [
  'VERIFIED',
  'SUPPORTED_WITH_LIMITATIONS',
  'CONFLICTED',
  'STALE_OR_CURRENTNESS_UNPROVEN',
  'UNRESOLVED',
  'PROFESSIONAL_DETERMINATION_REQUIRED',
] as const

export type ClaimState = (typeof CLAIM_STATES)[number]

/** Canada and Québec only. Other layers are a ceiling, not a vocabulary. */
export const IMPLEMENTED_JURISDICTION_CODES = ['CA', 'CA-QC'] as const

export type ImplementedJurisdiction = (typeof IMPLEMENTED_JURISDICTION_CODES)[number]

export const JURISDICTION_CEILING = [
  'municipal',
  'court',
  'regulatory',
  'foreign',
  'treaty',
] as const

export const STARE_DECISIS_CEILING = {
  automated: false,
  courtHierarchyResolved: false,
  note: 'Binding effect on a later decision-maker is not computed. Court hierarchy is not resolved.',
} as const

export const LEGAL_AUTHORITY_GRAPH = {
  ceiling: [
    'jurisdiction',
    'authority_source',
    'version_effective_period',
    'proposition',
    'factual_predicate',
    'support_conflict',
    'right_obligation_remedy',
    'decision',
    'evidence',
    'professional_gate',
  ],
  substrate: [
    'jurisdiction',
    'authority_source',
    'version_effective_period',
    'proposition',
    'factual_predicate',
    'support_conflict',
    'decision',
    'evidence',
    'professional_gate',
  ],
  notBuilt: ['right_obligation_remedy'],
  reasoningEngine: false,
} as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface SourceTemporal {
  readonly issued: string | null
  readonly effective: string | null
  readonly versionDate: string | null
  readonly repealOrSupersessionDate: string | null
  readonly lastVerified: string | null
}

export interface StatusAssertion {
  readonly status: LegalStatus
  readonly provenance: EvidenceRef | null
  readonly invented: false
}

export interface LegalAuthoritySource {
  readonly canonicalId: string
  readonly title: string
  readonly issuingBody: string
  readonly sourceClass: LegalSourceClass
  readonly tier: EvidenceTier
  readonly officialCitation: string | null
  readonly evidenceRef: EvidenceRef
  readonly jurisdiction: string | null
  readonly temporal: SourceTemporal
  readonly legalStatus: StatusAssertion
}

export interface LegalProposition {
  readonly id: string
  readonly statement: string
  readonly jurisdiction: string | null
}

export interface AuthorityRelationLink {
  readonly sourceId: string
  readonly propositionId: string
  readonly relation: AuthorityRelation
  readonly provenance: EvidenceRef
}

export interface FactualPredicate {
  readonly id: string
  readonly propositionId: string
  readonly statement: string
  readonly known: boolean
}

export interface CurrentnessContract {
  readonly sourceVersion: string | null
  readonly dateRetrieved: string | null
  readonly dateVerified: string | null
  readonly status: LegalStatus
  readonly evidence: readonly EvidenceRef[]
  readonly unresolvedConcerns: readonly string[]
  readonly provenCurrent: boolean
  readonly absenceOfContraryEvidenceIsProof: false
  readonly retrievalDateUsedAsVerification: false
}

export interface TemporalAssessment {
  readonly reading: 'VERIFIED_CURRENT_RULE' | 'APPLICABLE_ON_DATE' | 'HISTORICAL_NOT_CURRENT' | 'CURRENTNESS_UNKNOWN'
  readonly presentedAsCurrent: boolean
  readonly governsRelevantDate: true | false | 'UNRESOLVED'
  readonly retrievalDateUsedAsEffectiveDate: false
  readonly unresolved: readonly string[]
}

export interface BindingAssessment {
  readonly result: 'BINDING' | 'NOT_BINDING' | 'UNRESOLVED'
  readonly weight: AuthorityWeight | 'UNRESOLVED'
  readonly issuingCourt: string | null
  readonly governedJurisdiction: string | null
  readonly decisionMakerJurisdiction: string | null
  readonly crossJurisdictionAutoBinding: false
  readonly stareDecisisAutomated: false
  readonly unresolved: readonly string[]
}

export interface AuthorityConflict {
  readonly propositionId: string
  readonly sourceIds: readonly string[]
  readonly bothRetained: true
  readonly winner: null
  readonly jurisdictionDifference: string | null
  readonly hierarchyDifference: 'UNRESOLVED'
  readonly temporalDifference: string | null
  readonly unresolvedInterpretation: readonly string[]
  readonly verifierReviewRequired: true
  readonly professionalGateRequired: boolean
  readonly approvalOccurred: false
}

export interface PropositionAssessment {
  readonly propositionId: string
  readonly jurisdiction: string | null
  readonly established: boolean
  readonly claimState: ClaimState
  readonly supportingSourceIds: readonly string[]
  readonly contradictingSourceIds: readonly string[]
  readonly conflict: AuthorityConflict | null
  readonly assumedFacts: readonly FactualPredicate[]
  readonly unknownPredicates: readonly FactualPredicate[]
  readonly verifierReviewRequired: boolean
  readonly professionalGateRequired: boolean
  readonly approvalOccurred: false
  readonly advisoryOnly: true
}

export function tierForSourceClass(sourceClass: LegalSourceClass): EvidenceTier {
  switch (sourceClass) {
    case 'PRIMARY_BINDING':
      return 1
    case 'OFFICIAL_INTERPRETATION':
      return 2
    case 'PERSUASIVE_PROFESSIONAL':
      return 3
    case 'DISCOVERY':
      return 4
  }
}

export function jurisdictionImplemented(code: string | null): boolean {
  if (!code) return false
  return (IMPLEMENTED_JURISDICTION_CODES as readonly string[]).includes(code)
}

function hasRef(ref: EvidenceRef | null | undefined): ref is EvidenceRef {
  return Boolean(ref && ref.ref_id.trim().length > 0)
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

/** A status other than UNKNOWN is kept only when provenance is supplied. */
export function recordLegalStatus(
  status: LegalStatus,
  provenance: EvidenceRef | null,
): StatusAssertion {
  if (status === 'UNKNOWN' || !hasRef(provenance)) {
    return { status: 'UNKNOWN', provenance: null, invented: false }
  }
  return { status, provenance, invented: false }
}

export function defineLegalSource(input: {
  readonly canonicalId: string
  readonly title: string
  readonly issuingBody: string
  readonly sourceClass: LegalSourceClass
  readonly officialCitation?: string | null
  readonly evidenceRef: EvidenceRef
  readonly jurisdiction?: string | null
  readonly temporal: SourceTemporal
  readonly legalStatus: LegalStatus
  readonly statusProvenance: EvidenceRef | null
}): LegalAuthoritySource {
  return {
    canonicalId: input.canonicalId,
    title: input.title,
    issuingBody: input.issuingBody,
    sourceClass: input.sourceClass,
    tier: tierForSourceClass(input.sourceClass),
    officialCitation: blankToNull(input.officialCitation),
    evidenceRef: input.evidenceRef,
    jurisdiction: blankToNull(input.jurisdiction),
    temporal: {
      issued: blankToNull(input.temporal.issued),
      effective: blankToNull(input.temporal.effective),
      versionDate: blankToNull(input.temporal.versionDate),
      repealOrSupersessionDate: blankToNull(input.temporal.repealOrSupersessionDate),
      lastVerified: blankToNull(input.temporal.lastVerified),
    },
    legalStatus: recordLegalStatus(input.legalStatus, input.statusProvenance),
  }
}

export function recordCurrentness(input: {
  readonly sourceVersion: string | null
  readonly dateRetrieved: string | null
  readonly dateVerified: string | null
  readonly assertedStatus: LegalStatus
  readonly evidence: readonly EvidenceRef[]
  readonly unresolvedConcerns: readonly string[]
}): CurrentnessContract {
  const evidence = input.evidence.filter(hasRef)
  const dateVerified = blankToNull(input.dateVerified)
  const concerns = input.unresolvedConcerns.filter((item) => item.trim().length > 0)
  const historical = input.assertedStatus !== 'CURRENT' && input.assertedStatus !== 'UNKNOWN'
  const status = historical && evidence.length > 0
    ? input.assertedStatus
    : input.assertedStatus === 'CURRENT' && evidence.length > 0 && dateVerified
      ? 'CURRENT'
      : 'UNKNOWN'
  const provenCurrent = status === 'CURRENT' && concerns.length === 0 && dateVerified !== null
  return {
    sourceVersion: blankToNull(input.sourceVersion),
    dateRetrieved: blankToNull(input.dateRetrieved),
    dateVerified,
    status,
    evidence,
    unresolvedConcerns: concerns,
    provenCurrent,
    absenceOfContraryEvidenceIsProof: false,
    retrievalDateUsedAsVerification: false,
  }
}

function isIsoDate(value: string | null): value is string {
  return value !== null && ISO_DATE.test(value)
}

function compareIso(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const HISTORICAL_STATUSES: readonly LegalStatus[] = [
  'AMENDED',
  'REPEALED',
  'SUPERSEDED',
  'OVERRULED',
  'PARTIALLY_OVERRULED',
]

export function assessTemporal(input: {
  readonly source: LegalAuthoritySource
  readonly relevantDate: string | null
  readonly retrievalDate: string | null
}): TemporalAssessment {
  const status = input.source.legalStatus.status
  const verified = isIsoDate(input.source.temporal.lastVerified)
    && hasRef(input.source.legalStatus.provenance)
  const presentedAsCurrent = status === 'CURRENT' && verified
  const unresolved: string[] = []
  if (input.retrievalDate) {
    unresolved.push('Retrieval date is not an effective date and is not currentness.')
  }

  let governsRelevantDate: TemporalAssessment['governsRelevantDate'] = 'UNRESOLVED'
  const relevant = blankToNull(input.relevantDate)
  const effective = input.source.temporal.effective
  const ended = input.source.temporal.repealOrSupersessionDate
  if (!isIsoDate(relevant) || !isIsoDate(effective)) {
    governsRelevantDate = 'UNRESOLVED'
    unresolved.push('Applicability on a date stays unresolved when the date or the effective date is unknown.')
  } else if (compareIso(relevant, effective) < 0) {
    governsRelevantDate = false
  } else if (isIsoDate(ended) && compareIso(relevant, ended) >= 0) {
    governsRelevantDate = false
  } else if (HISTORICAL_STATUSES.includes(status) && !isIsoDate(ended)) {
    governsRelevantDate = 'UNRESOLVED'
    unresolved.push('A historical status without an end date does not establish applicability.')
  } else {
    governsRelevantDate = true
  }

  let reading: TemporalAssessment['reading']
  if (HISTORICAL_STATUSES.includes(status)) {
    reading = 'HISTORICAL_NOT_CURRENT'
  } else if (presentedAsCurrent && input.relevantDate === null) {
    reading = 'VERIFIED_CURRENT_RULE'
  } else if (governsRelevantDate === true && !presentedAsCurrent) {
    reading = 'APPLICABLE_ON_DATE'
  } else if (presentedAsCurrent && governsRelevantDate === true) {
    reading = 'APPLICABLE_ON_DATE'
  } else {
    reading = 'CURRENTNESS_UNKNOWN'
  }

  return {
    reading,
    presentedAsCurrent,
    governsRelevantDate,
    retrievalDateUsedAsEffectiveDate: false,
    unresolved,
  }
}

export function assessBinding(input: {
  readonly issuingCourt: string | null
  readonly governedJurisdiction: string | null
  readonly decisionMakerJurisdiction: string | null
  readonly bindingOnDecisionMaker: boolean | null
  readonly laterEffect: 'NONE_RECORDED' | 'OVERRULED' | 'PARTIALLY_OVERRULED' | 'UNKNOWN'
}): BindingAssessment {
  const issuingCourt = blankToNull(input.issuingCourt)
  const governedJurisdiction = blankToNull(input.governedJurisdiction)
  const decisionMakerJurisdiction = blankToNull(input.decisionMakerJurisdiction)
  const base = {
    issuingCourt,
    governedJurisdiction,
    decisionMakerJurisdiction,
    crossJurisdictionAutoBinding: false as const,
    stareDecisisAutomated: false as const,
  }

  if (!issuingCourt || !governedJurisdiction || !decisionMakerJurisdiction) {
    return {
      ...base,
      result: 'UNRESOLVED',
      weight: 'UNRESOLVED',
      unresolved: ['Issuing court or jurisdiction is unknown. Binding effect is not established.'],
    }
  }

  if (governedJurisdiction !== decisionMakerJurisdiction) {
    return {
      ...base,
      result: 'UNRESOLVED',
      weight: 'UNRESOLVED',
      unresolved: ['Authority from one jurisdiction is not binding in another. Stare decisis is not automated.'],
    }
  }

  if (input.laterEffect === 'OVERRULED') {
    return {
      ...base,
      result: 'NOT_BINDING',
      weight: 'UNRESOLVED',
      unresolved: ['Later effect is overruled. No replacement authority is selected.'],
    }
  }

  if (input.laterEffect !== 'NONE_RECORDED' || input.bindingOnDecisionMaker === null) {
    return {
      ...base,
      result: 'UNRESOLVED',
      weight: 'UNRESOLVED',
      unresolved: ['Binding on the decision-maker is not deterministically established.'],
    }
  }

  if (input.bindingOnDecisionMaker === false) {
    return {
      ...base,
      result: 'NOT_BINDING',
      weight: 'UNRESOLVED',
      unresolved: [],
    }
  }

  return {
    ...base,
    result: 'BINDING',
    weight: 'BINDING',
    unresolved: [],
  }
}

function sourcesById(sources: readonly LegalAuthoritySource[]): Map<string, LegalAuthoritySource> {
  return new Map(sources.map((source) => [source.canonicalId, source]))
}

export function surfaceConflict(input: {
  readonly propositionId: string
  readonly links: readonly AuthorityRelationLink[]
  readonly sources: readonly LegalAuthoritySource[]
  readonly professionalGateRequired: boolean
}): AuthorityConflict | null {
  const related = input.links.filter(
    (link) => link.propositionId === input.propositionId && hasRef(link.provenance),
  )
  const supports = related.filter((link) => link.relation === 'SUPPORTS' || link.relation === 'AFFIRMS')
  const contradicts = related.filter((link) => link.relation === 'CONTRADICTS' || link.relation === 'REVERSES')
  if (supports.length === 0 || contradicts.length === 0) return null

  const sourceIds = [...new Set([...supports, ...contradicts].map((link) => link.sourceId))]
  const byId = sourcesById(input.sources)
  const jurisdictions = [...new Set(sourceIds.map((id) => byId.get(id)?.jurisdiction ?? null))]
  const jurisdictionDifference = jurisdictions.length > 1
    ? jurisdictions.map((code) => code ?? 'UNKNOWN').join(' | ')
    : null
  const effectives = sourceIds.map((id) => byId.get(id)?.temporal.effective ?? null)
  const temporalDifference = new Set(effectives).size > 1
    ? effectives.map((date) => date ?? 'UNKNOWN').join(' | ')
    : null

  return {
    propositionId: input.propositionId,
    sourceIds,
    bothRetained: true,
    winner: null,
    jurisdictionDifference,
    hierarchyDifference: 'UNRESOLVED',
    temporalDifference,
    unresolvedInterpretation: ['Both authorities are retained. No winner is selected.'],
    verifierReviewRequired: true,
    professionalGateRequired: input.professionalGateRequired,
    approvalOccurred: false,
  }
}

export function separateRuleFromFacts(input: {
  readonly rule: LegalProposition
  readonly predicates: readonly FactualPredicate[]
}): {
  readonly rule: LegalProposition
  readonly assumedFacts: readonly FactualPredicate[]
  readonly unknownPredicates: readonly FactualPredicate[]
} {
  const related = input.predicates.filter((predicate) => predicate.propositionId === input.rule.id)
  return {
    rule: input.rule,
    assumedFacts: related.filter((predicate) => predicate.known),
    unknownPredicates: related.filter((predicate) => !predicate.known),
  }
}

function linkSupportsEstablishment(
  link: AuthorityRelationLink,
  source: LegalAuthoritySource | undefined,
): boolean {
  if (!source) return false
  if (link.relation !== 'SUPPORTS' && link.relation !== 'AFFIRMS') return false
  if (source.tier >= 4) return false
  return hasRef(link.provenance) && hasRef(source.evidenceRef)
}

export function assessProposition(input: {
  readonly proposition: LegalProposition
  readonly links: readonly AuthorityRelationLink[]
  readonly sources: readonly LegalAuthoritySource[]
  readonly predicates: readonly FactualPredicate[]
  readonly professionalDeterminationRequired: boolean
  readonly limitations: readonly string[]
  readonly readingPurpose: 'CURRENT_RULE' | 'APPLICABLE_ON_DATE'
}): PropositionAssessment {
  const related = input.links.filter((link) => link.propositionId === input.proposition.id)
  const byId = sourcesById(input.sources)
  const supporting = related.filter((link) => linkSupportsEstablishment(link, byId.get(link.sourceId)))
  const contradicting = related.filter((link) =>
    (link.relation === 'CONTRADICTS' || link.relation === 'REVERSES') && hasRef(link.provenance),
  )
  const tier4Only = related.some((link) => byId.get(link.sourceId)?.tier === 4)
    && supporting.length === 0
    && contradicting.length === 0
  const facts = separateRuleFromFacts({ rule: input.proposition, predicates: input.predicates })
  const conflict = surfaceConflict({
    propositionId: input.proposition.id,
    links: input.links,
    sources: input.sources,
    professionalGateRequired: input.professionalDeterminationRequired,
  })

  const supportingSources = supporting.map((link) => byId.get(link.sourceId)).filter((source) => source !== undefined)
  const currentProven = supportingSources.length > 0 && supportingSources.every((source) =>
    source.legalStatus.status === 'CURRENT'
    && hasRef(source.legalStatus.provenance)
    && isIsoDate(source.temporal.lastVerified),
  )

  let claimState: ClaimState
  if (conflict) {
    claimState = 'CONFLICTED'
  } else if (supporting.length === 0 || tier4Only) {
    claimState = 'UNRESOLVED'
  } else if (input.readingPurpose === 'CURRENT_RULE' && !currentProven) {
    claimState = 'STALE_OR_CURRENTNESS_UNPROVEN'
  } else if (facts.unknownPredicates.length > 0) {
    claimState = 'UNRESOLVED'
  } else if (input.professionalDeterminationRequired) {
    claimState = 'PROFESSIONAL_DETERMINATION_REQUIRED'
  } else if (input.limitations.length > 0 || input.readingPurpose === 'APPLICABLE_ON_DATE') {
    claimState = 'SUPPORTED_WITH_LIMITATIONS'
  } else {
    claimState = 'VERIFIED'
  }

  return {
    propositionId: input.proposition.id,
    jurisdiction: input.proposition.jurisdiction,
    established: supporting.length > 0 && conflict === null && claimState !== 'UNRESOLVED' && claimState !== 'STALE_OR_CURRENTNESS_UNPROVEN',
    claimState,
    supportingSourceIds: supporting.map((link) => link.sourceId),
    contradictingSourceIds: contradicting.map((link) => link.sourceId),
    conflict,
    assumedFacts: facts.assumedFacts,
    unknownPredicates: facts.unknownPredicates,
    verifierReviewRequired: conflict !== null || input.professionalDeterminationRequired,
    professionalGateRequired: input.professionalDeterminationRequired,
    approvalOccurred: false,
    advisoryOnly: true,
  }
}
