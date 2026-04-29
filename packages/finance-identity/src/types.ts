import type { KycStatus, SanctionsStatus, RiskTier } from '@nzila/finance-compliance'

export type FinanceSubjectType = 'user' | 'org' | 'member'

export interface FinanceIdentityProfile {
  id: string
  orgId: string
  subjectId: string
  subjectType: FinanceSubjectType
  displayName: string
  kycStatus: KycStatus
  sanctionsStatus: SanctionsStatus
  riskTier: RiskTier
  createdAt: string
  updatedAt: string
  verifiedAt?: string
}

export interface IdentityRiskScore {
  profileId: string
  score: number
  tier: RiskTier
  factors: string[]
  computedAt: string
}
