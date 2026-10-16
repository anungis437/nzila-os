/**
 * Decision classes projected onto the existing decision-engine policy context.
 * GREEN is a choice the principal may make without a professional gate.
 * It is not permission for CIVITAS to execute.
 * No numeric score is computed. A score cannot override a prohibition.
 */
import type { DecisionSeverity, PolicyContext } from '@nzila/platform-decision-engine/types'

export type DecisionClass = 'GREEN' | 'AMBER' | 'RED' | 'BLACK'

export const PROFESSIONAL_ROLES = [
  'lawyer',
  'quebec_notary',
  'cpa',
  'tax_specialist',
] as const

export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number]

export const RED_MATTERS = [
  'tax_restructuring',
  'trust',
  'estate_instrument',
  'cross_border_residence',
  'constitutional_proceeding',
  'material_asset_transfer',
  'litigation',
  'significant_regulated_filing',
] as const

export type RedMatter = (typeof RED_MATTERS)[number]

export const AMBER_MATTERS = [
  'official_interpretation_reliance',
  'regulated_choice_pending_verification',
] as const

export type AmberMatter = (typeof AMBER_MATTERS)[number]

export const GREEN_MATTERS = [
  'record_organization',
  'choice_among_disclosed_lawful_options',
] as const

export type GreenMatter = (typeof GREEN_MATTERS)[number]

export type MatterKind = RedMatter | AmberMatter | GreenMatter

export const PROFESSIONAL_GATE_FOR_RED: Record<RedMatter, readonly ProfessionalRole[]> = {
  tax_restructuring: ['tax_specialist', 'cpa'],
  trust: ['lawyer', 'quebec_notary'],
  estate_instrument: ['lawyer', 'quebec_notary'],
  cross_border_residence: ['lawyer', 'tax_specialist'],
  constitutional_proceeding: ['lawyer'],
  material_asset_transfer: ['lawyer'],
  litigation: ['lawyer'],
  significant_regulated_filing: ['lawyer'],
}

export const AUTONOMY_BENEFIT_DIMENSIONS = [
  'control',
  'optionality',
  'privacy',
  'resilience',
  'reversibility',
  'continuity',
  'evidence_quality',
  'jurisdictional_clarity',
] as const

export const EXPOSURE_DIMENSIONS = [
  'legal',
  'tax',
  'regulatory',
  'fiduciary',
  'creditor',
  'contractual',
  'disclosure',
  'operational',
] as const

/** Future scoring is named here and is not computed. */
export const SCORING_STATUS = 'NOT_IMPLEMENTED_NO_FALSE_PRECISION' as const

export function scoreCannotOverrideProhibition(
  _score: unknown,
  prohibited: boolean,
): boolean {
  return prohibited
}

export interface ClassAssessment {
  readonly decisionClass: DecisionClass
  readonly professionalGate: readonly ProfessionalRole[]
  readonly verifierReviewRequired: boolean
  readonly severity: DecisionSeverity
  readonly policyContext: PolicyContext
  readonly scoringStatus: typeof SCORING_STATUS
}

function isRed(kind: string): kind is RedMatter {
  return (RED_MATTERS as readonly string[]).includes(kind)
}

function isAmber(kind: string): kind is AmberMatter {
  return (AMBER_MATTERS as readonly string[]).includes(kind)
}

function isGreen(kind: string): kind is GreenMatter {
  return (GREEN_MATTERS as readonly string[]).includes(kind)
}

const EXECUTION_DENIED: PolicyContext = {
  execution_allowed: false,
  reasons: ['CIVITAS execution authority is none.'],
}

export function classifyMatter(input: {
  readonly matterKind?: string
  readonly prohibited: boolean
  readonly score?: unknown
}): ClassAssessment {
  if (scoreCannotOverrideProhibition(input.score, input.prohibited)) {
    return {
      decisionClass: 'BLACK',
      professionalGate: ['lawyer'],
      verifierReviewRequired: true,
      severity: 'CRITICAL',
      policyContext: {
        execution_allowed: false,
        reasons: [
          'CIVITAS execution authority is none.',
          'Prohibited mechanism. A score cannot authorize it.',
        ],
      },
      scoringStatus: SCORING_STATUS,
    }
  }

  if (input.matterKind && isRed(input.matterKind)) {
    return {
      decisionClass: 'RED',
      professionalGate: PROFESSIONAL_GATE_FOR_RED[input.matterKind],
      verifierReviewRequired: true,
      severity: 'HIGH',
      policyContext: {
        execution_allowed: false,
        reasons: [
          'CIVITAS execution authority is none.',
          'Material professional-risk matter. VERIFIER review is required before reliance.',
        ],
      },
      scoringStatus: SCORING_STATUS,
    }
  }

  if (input.matterKind && isAmber(input.matterKind)) {
    return {
      decisionClass: 'AMBER',
      professionalGate: [],
      verifierReviewRequired: true,
      severity: 'MEDIUM',
      policyContext: {
        execution_allowed: false,
        reasons: [
          'CIVITAS execution authority is none.',
          'Regulated choice. Verification is required before reliance.',
        ],
      },
      scoringStatus: SCORING_STATUS,
    }
  }

  if (input.matterKind && isGreen(input.matterKind)) {
    return {
      decisionClass: 'GREEN',
      professionalGate: [],
      verifierReviewRequired: false,
      severity: 'LOW',
      policyContext: EXECUTION_DENIED,
      scoringStatus: SCORING_STATUS,
    }
  }

  return {
    decisionClass: 'AMBER',
    professionalGate: [],
    verifierReviewRequired: true,
    severity: 'MEDIUM',
    policyContext: {
      execution_allowed: false,
      reasons: [
        'CIVITAS execution authority is none.',
        'Unclassified matter stays unverified.',
      ],
    },
    scoringStatus: SCORING_STATUS,
  }
}
