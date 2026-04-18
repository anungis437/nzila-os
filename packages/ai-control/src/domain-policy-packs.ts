import type { AIPolicyDecision } from './schemas'

export type DomainPolicyDomain = 'labour' | 'finance' | 'legal' | 'education' | 'media'

export interface DomainPolicyPack {
  id: string
  domain: DomainPolicyDomain
  version: string
  enabled: boolean
  thresholds: {
    minConfidence: number
    blockingConfidence: number
  }
}

export interface DomainPolicyInput {
  domain: DomainPolicyDomain
  actionType: string
  confidenceScore?: number | null
  hasEvidence?: boolean
  containsLegalRiskLanguage?: boolean
  protectedClassSensitive?: boolean
  highRiskRecommendation?: boolean
  taxPayrollUncertainty?: boolean
  lowConfidenceGradingHelp?: boolean
  legalInterpretation?: boolean
  citationsRequired?: boolean
  citationsIncluded?: boolean
  riskTier?: 'low' | 'medium' | 'high' | 'critical'
  answerLeakageSignal?: boolean
  cheatingSignal?: boolean
  ageAppropriateTone?: boolean
  explicitContentDetected?: boolean
  rightsConflictDetected?: boolean
  payoutAnomalyDetected?: boolean
  impersonationFraudSignal?: boolean
}

export interface DomainPolicyDecision extends AIPolicyDecision {
  domain: DomainPolicyDomain
  policyVersion: string
  reviewRequired: boolean
  blocked: boolean
  escalationTags: string[]
  requiredLabels: string[]
}

export const defaultDomainPolicyPacks: Record<DomainPolicyDomain, DomainPolicyPack> = {
  labour: {
    id: 'labour-policy-pack',
    domain: 'labour',
    version: '2026.04.18',
    enabled: true,
    thresholds: {
      minConfidence: 0.72,
      blockingConfidence: 0.45,
    },
  },
  finance: {
    id: 'finance-policy-pack',
    domain: 'finance',
    version: '2026.04.18',
    enabled: true,
    thresholds: {
      minConfidence: 0.78,
      blockingConfidence: 0.55,
    },
  },
  legal: {
    id: 'legal-policy-pack',
    domain: 'legal',
    version: '2026.04.18',
    enabled: true,
    thresholds: {
      minConfidence: 0.75,
      blockingConfidence: 0.5,
    },
  },
  education: {
    id: 'education-policy-pack',
    domain: 'education',
    version: '2026.04.18',
    enabled: true,
    thresholds: {
      minConfidence: 0.7,
      blockingConfidence: 0.48,
    },
  },
  media: {
    id: 'media-policy-pack',
    domain: 'media',
    version: '2026.04.18',
    enabled: true,
    thresholds: {
      minConfidence: 0.68,
      blockingConfidence: 0.42,
    },
  },
}

function mergePack(
  domain: DomainPolicyDomain,
  override?: Partial<DomainPolicyPack>,
): DomainPolicyPack {
  const base = defaultDomainPolicyPacks[domain]
  return {
    ...base,
    ...override,
    thresholds: {
      ...base.thresholds,
      ...override?.thresholds,
    },
  }
}

export function evaluateDomainPolicy(
  input: DomainPolicyInput,
  override?: Partial<DomainPolicyPack>,
): DomainPolicyDecision {
  const pack = mergePack(input.domain, override)

  if (!pack.enabled) {
    return {
      allowed: true,
      reason: 'Domain policy pack disabled',
      policyId: pack.id,
      domain: input.domain,
      policyVersion: pack.version,
      reviewRequired: false,
      blocked: false,
      escalationTags: [],
      requiredLabels: [],
    }
  }

  const confidence = typeof input.confidenceScore === 'number' ? input.confidenceScore : 1
  const escalationTags: string[] = []
  const requiredLabels: string[] = []
  let reviewRequired = false
  let blocked = false

  if (confidence < pack.thresholds.blockingConfidence) {
    blocked = true
    escalationTags.push('low-confidence-block')
  } else if (confidence < pack.thresholds.minConfidence) {
    reviewRequired = true
    escalationTags.push('low-confidence-review')
  }

  if (input.domain === 'labour') {
    if (input.actionType === 'grievance_recommendation' || input.actionType === 'discipline_outcome') {
      reviewRequired = true
      escalationTags.push('labour-sensitive-outcome')
    }
    if (input.containsLegalRiskLanguage) escalationTags.push('labour-legal-risk-language')
    if (input.protectedClassSensitive) {
      reviewRequired = true
      escalationTags.push('protected-class-sensitive')
    }
  }

  if (input.domain === 'finance') {
    if (input.actionType === 'forecast') {
      requiredLabels.push('non-advisory')
    }
    if (input.highRiskRecommendation) {
      reviewRequired = true
      escalationTags.push('high-risk-financial-recommendation')
    }
    if (input.taxPayrollUncertainty) {
      reviewRequired = true
      escalationTags.push('tax-payroll-uncertainty')
    }
    if (input.lowConfidenceGradingHelp || confidence < pack.thresholds.blockingConfidence) {
      blocked = true
      escalationTags.push('finance-low-confidence-block')
    }
  }

  if (input.domain === 'legal') {
    if (input.legalInterpretation || input.actionType === 'legal_interpretation') {
      reviewRequired = true
      escalationTags.push('legal-interpretation-human-review')
    }
    if (input.citationsRequired && !input.citationsIncluded) {
      blocked = true
      escalationTags.push('legal-citation-required')
    }
    if (input.riskTier === 'high' || input.riskTier === 'critical') {
      reviewRequired = true
      escalationTags.push('legal-risk-tier-routing')
    }
  }

  if (input.domain === 'education') {
    if (input.answerLeakageSignal) {
      blocked = true
      escalationTags.push('answer-leakage-detected')
    }
    if (input.cheatingSignal) {
      reviewRequired = true
      escalationTags.push('cheating-integrity-escalation')
    }
    if (input.ageAppropriateTone === false) {
      blocked = true
      escalationTags.push('age-appropriate-tone-violation')
    }
    if (input.lowConfidenceGradingHelp) {
      blocked = true
      escalationTags.push('grading-help-low-confidence')
    }
  }

  if (input.domain === 'media') {
    if (input.explicitContentDetected) {
      reviewRequired = true
      requiredLabels.push('explicit-content')
      escalationTags.push('moderation-queue')
    }
    if (input.rightsConflictDetected) {
      reviewRequired = true
      escalationTags.push('copyright-rights-escalation')
    }
    if (input.payoutAnomalyDetected) {
      reviewRequired = true
      escalationTags.push('payout-anomaly-alert')
    }
    if (input.impersonationFraudSignal) {
      reviewRequired = true
      escalationTags.push('impersonation-fraud-signal')
    }
  }

  if (input.hasEvidence === false) {
    reviewRequired = true
    escalationTags.push('missing-evidence')
  }

  const allowed = !blocked
  const reason = blocked
    ? `Blocked by ${pack.id}`
    : reviewRequired
      ? `Requires review by ${pack.id}`
      : `Policy checks passed by ${pack.id}`

  return {
    allowed,
    reason,
    policyId: pack.id,
    restrictions: escalationTags,
    domain: input.domain,
    policyVersion: pack.version,
    reviewRequired,
    blocked,
    escalationTags,
    requiredLabels,
  }
}
