/**
 * Analysis contract.
 *
 * Fields follow the work a lawful-autonomy analysis has to hold.
 * The projection reuses decision-engine evidence references and policy context.
 * It does not register a new decision-core type and it never sets execution.
 */
import type {
  DecisionRecord,
  DecisionStatus,
  DecisionType,
} from '@nzila/platform-decision-engine/types'
import type { DecisionDomain } from '@nzila/decision-core'

import { CIVITAS_IDENTITY, DEFAULT_JURISDICTION } from './identity'
import type { CivitasEvidence, EpistemicLabel } from './evidence'
import { supportForProposition } from './evidence'
import type { DecisionClass, ProfessionalRole } from './decisions'
import { classifyMatter } from './decisions'
import { evaluateMechanism, findFaultyDoctrine, rejectFaultyDoctrine, rejectProhibitedMechanism } from './pseudolaw'
import type { DoctrineRejection, MechanismDisposition, ProhibitedMechanismId } from './pseudolaw'

export interface ControlEffects {
  readonly control: string
  readonly privacy: string
  readonly tax: string
  readonly liability: string
  readonly continuity: string
}

export interface AnalysisInput {
  readonly orgId: string
  readonly decisionId: string
  readonly asOf: string
  readonly objective: string
  readonly facts: readonly string[]
  readonly jurisdiction?: string
  readonly useDefaultJurisdiction?: boolean
  readonly authority: string
  readonly mandatoryLayer: readonly string[]
  readonly discretionaryLayer: readonly string[]
  readonly options: readonly string[]
  readonly effects: ControlEffects
  readonly reversibility: string
  readonly evidence: readonly CivitasEvidence[]
  readonly propositionId: string
  readonly uncertainty: readonly string[]
  readonly professionalGate: readonly ProfessionalRole[]
  readonly recommendation: string
  readonly matterKind?: string
  readonly mechanismText?: string
  readonly prohibitedMechanism?: ProhibitedMechanismId
  readonly benefitScore?: unknown
  readonly autonomyScore?: unknown
  readonly confidenceScore?: unknown
  readonly userPreference?: unknown
  readonly agentRecommendation?: unknown
  readonly professionalReviewMarker?: unknown
  readonly sourceMetadata?: unknown
}

export interface AdvisoryDecisionProjection {
  readonly decision_id: string
  readonly org_id: string
  readonly category: 'GOVERNANCE' | 'COMPLIANCE'
  readonly type: DecisionType
  readonly severity: DecisionRecord['severity']
  readonly title: string
  readonly summary: string
  readonly explanation: string
  readonly evidence_refs: DecisionRecord['evidence_refs']
  readonly recommended_actions: readonly string[]
  readonly required_approvals: readonly string[]
  readonly review_required: true
  readonly policy_context: DecisionRecord['policy_context']
  readonly status: Exclude<DecisionStatus, 'EXECUTED' | 'APPROVED'>
  readonly generated_at: string
  readonly generated_by: DecisionRecord['generated_by']
  readonly domain: Extract<DecisionDomain, 'legal'>
}

export interface AnalysisResult {
  readonly ok: boolean
  readonly code: string
  readonly decisionClass: DecisionClass | null
  readonly advisoryOnly: true
  readonly executionAuthority: 'none'
  readonly counselOfRecord: false
  readonly reviewRequired: true
  readonly verifierReviewRequired: boolean
  readonly epistemicLabel: EpistemicLabel
  readonly jurisdiction: string | null
  readonly uncertainty: readonly string[]
  readonly professionalGate: readonly ProfessionalRole[]
  readonly recommendation: string | null
  readonly lawfulPathway: string | null
  readonly rejection: DoctrineRejection | null
  readonly projection: AdvisoryDecisionProjection | null
  readonly approvalOccurred: false
  readonly gateImpliesApproval: false
  readonly mechanismDisposition: MechanismDisposition
  readonly indicatorAbsenceIsLawfulEvidence: false
}

const JURISDICTION_CODE = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/

function blocked(input: {
  readonly code: string
  readonly decisionClass: DecisionClass | null
  readonly jurisdiction: string | null
  readonly uncertainty: readonly string[]
  readonly rejection?: DoctrineRejection | null
  readonly lawfulPathway?: string | null
  readonly verifierReviewRequired?: boolean
  readonly professionalGate?: readonly ProfessionalRole[]
  readonly mechanismDisposition?: MechanismDisposition
}): AnalysisResult {
  return {
    ok: false,
    code: input.code,
    decisionClass: input.decisionClass,
    advisoryOnly: true,
    executionAuthority: 'none',
    counselOfRecord: false,
    reviewRequired: true,
    verifierReviewRequired: input.verifierReviewRequired ?? false,
    epistemicLabel: 'UNRESOLVED',
    jurisdiction: input.jurisdiction,
    uncertainty: input.uncertainty,
    professionalGate: input.professionalGate ?? [],
    recommendation: null,
    lawfulPathway: input.lawfulPathway ?? null,
    rejection: input.rejection ?? null,
    projection: null,
    approvalOccurred: false,
    gateImpliesApproval: false,
    mechanismDisposition: input.mechanismDisposition ?? 'UNRESOLVED',
    indicatorAbsenceIsLawfulEvidence: false,
  }
}

function resolveJurisdiction(input: AnalysisInput): string | null {
  const explicit = input.jurisdiction?.trim() ?? ''
  if (explicit) return explicit
  if (input.useDefaultJurisdiction) return DEFAULT_JURISDICTION
  return null
}

function scanText(input: AnalysisInput): DoctrineRejection | null {
  const combined = [
    input.objective,
    input.recommendation,
    input.mechanismText ?? '',
    ...input.facts,
    ...input.options,
  ].join('\n')
  const faulty = findFaultyDoctrine(combined)
  return faulty ? rejectFaultyDoctrine(faulty) : null
}

export function analyze(input: AnalysisInput): AnalysisResult {
  if (input.prohibitedMechanism) {
    const rejection = rejectProhibitedMechanism(input.prohibitedMechanism)
    void input.benefitScore
    void input.autonomyScore
    void input.confidenceScore
    void input.userPreference
    void input.agentRecommendation
    void input.professionalReviewMarker
    void input.sourceMetadata
    return blocked({
      code: 'BLACK_MECHANISM',
      decisionClass: 'BLACK',
      jurisdiction: resolveJurisdiction(input),
      uncertainty: input.uncertainty,
      rejection,
      lawfulPathway: rejection.lawfulMechanism,
      verifierReviewRequired: true,
      professionalGate: ['lawyer'],
      mechanismDisposition: 'PROHIBITED',
    })
  }

  const rejection = scanText(input)
  if (rejection) {
    return blocked({
      code: 'BLACK_MECHANISM',
      decisionClass: 'BLACK',
      jurisdiction: resolveJurisdiction(input),
      uncertainty: input.uncertainty,
      rejection,
      lawfulPathway: rejection.lawfulMechanism,
      verifierReviewRequired: true,
      professionalGate: ['lawyer'],
      mechanismDisposition: 'PROHIBITED',
    })
  }

  const unrecognized = evaluateMechanism({
    mechanismText: input.mechanismText,
    affirmativeLawfulBasis: true,
  })
  if ((input.mechanismText?.trim() ?? '').length > 0 && unrecognized.disposition === 'UNRESOLVED') {
    return blocked({
      code: 'MECHANISM_UNRESOLVED',
      decisionClass: null,
      jurisdiction: resolveJurisdiction(input),
      uncertainty: input.uncertainty,
      verifierReviewRequired: true,
      mechanismDisposition: 'UNRESOLVED',
    })
  }

  const jurisdiction = resolveJurisdiction(input)
  if (!jurisdiction || !JURISDICTION_CODE.test(jurisdiction)) {
    return blocked({
      code: 'JURISDICTION_BEFORE_CONCLUSION',
      decisionClass: null,
      jurisdiction: null,
      uncertainty: input.uncertainty,
    })
  }

  if (!input.authority.trim()) {
    return blocked({
      code: 'AUTHORITY_BEFORE_ASSERTION',
      decisionClass: null,
      jurisdiction,
      uncertainty: input.uncertainty,
    })
  }

  if (input.mandatoryLayer.length === 0 || input.discretionaryLayer.length === 0) {
    return blocked({
      code: 'RIGHTS_AND_OBLIGATIONS_REQUIRED',
      decisionClass: null,
      jurisdiction,
      uncertainty: input.uncertainty,
    })
  }

  if (input.uncertainty.length === 0) {
    return blocked({
      code: 'UNCERTAINTY_REQUIRED',
      decisionClass: null,
      jurisdiction,
      uncertainty: [],
    })
  }

  const classified = classifyMatter({
    matterKind: input.matterKind,
    prohibited: false,
  })

  if (classified.decisionClass === 'RED') {
    const provided = new Set(input.professionalGate)
    const missing = classified.professionalGate.filter((role) => !provided.has(role))
    if (missing.length > 0) {
      return blocked({
        code: 'PROFESSIONAL_GATE_REQUIRED',
        decisionClass: 'RED',
        jurisdiction,
        uncertainty: input.uncertainty,
        verifierReviewRequired: true,
        professionalGate: classified.professionalGate,
      })
    }
  }

  const support = supportForProposition(input.evidence, input.propositionId)
  if (!support.established) {
    return blocked({
      code: support.reason,
      decisionClass: classified.decisionClass,
      jurisdiction,
      uncertainty: input.uncertainty,
      verifierReviewRequired: classified.verifierReviewRequired,
      professionalGate: classified.professionalGate,
    })
  }

  const epistemicLabel: EpistemicLabel =
    classified.decisionClass === 'RED' ? 'PROFESSIONAL_DETERMINATION_REQUIRED' : 'INFERENCE'

  const projection: AdvisoryDecisionProjection = {
    decision_id: input.decisionId,
    org_id: input.orgId,
    category: classified.decisionClass === 'RED' ? 'COMPLIANCE' : 'GOVERNANCE',
    type: classified.decisionClass === 'RED' ? 'ESCALATION' : 'RECOMMENDATION',
    severity: classified.severity,
    title: input.objective,
    summary: input.recommendation,
    explanation: [
      `Jurisdiction ${jurisdiction}.`,
      `Authority: ${input.authority}.`,
      `Mandatory: ${input.mandatoryLayer.join('; ')}.`,
      `Discretionary: ${input.discretionaryLayer.join('; ')}.`,
      `Uncertainty: ${input.uncertainty.join('; ')}.`,
      `Reversibility: ${input.reversibility}.`,
      support.currentlyVerified
        ? `Currently verified as of ${support.lawAsOf}.`
        : `Law as of ${support.lawAsOf}. Not claimed as currently verified.`,
    ].join(' '),
    evidence_refs: support.provenance,
    recommended_actions: [input.recommendation],
    required_approvals: classified.professionalGate,
    review_required: true,
    policy_context: classified.policyContext,
    status: classified.decisionClass === 'RED' ? 'PENDING_REVIEW' : 'GENERATED',
    generated_at: input.asOf,
    generated_by: {
      source: 'agent_workflow',
      engine_version: `${CIVITAS_IDENTITY.key}@${CIVITAS_IDENTITY.phase}`,
    },
    domain: 'legal',
  }

  if (projection.policy_context.execution_allowed) {
    return blocked({
      code: 'AUTHORITY_EXCEEDED',
      decisionClass: classified.decisionClass,
      jurisdiction,
      uncertainty: input.uncertainty,
    })
  }

  return {
    ok: true,
    code: classified.decisionClass,
    decisionClass: classified.decisionClass,
    advisoryOnly: true,
    executionAuthority: 'none',
    counselOfRecord: false,
    reviewRequired: true,
    verifierReviewRequired: classified.verifierReviewRequired,
    epistemicLabel,
    jurisdiction,
    uncertainty: input.uncertainty,
    professionalGate: classified.professionalGate,
    recommendation: input.recommendation,
    lawfulPathway: input.recommendation,
    rejection: null,
    projection,
    approvalOccurred: false,
    gateImpliesApproval: false,
    mechanismDisposition: evaluateMechanism({
      mechanismText: input.mechanismText,
      affirmativeLawfulBasis: classified.decisionClass === 'GREEN' || classified.decisionClass === 'AMBER',
    }).disposition,
    indicatorAbsenceIsLawfulEvidence: false,
  }
}
