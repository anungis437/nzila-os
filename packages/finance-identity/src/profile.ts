import { createHash } from 'node:crypto'
import type { FinanceIdentityProfile, IdentityRiskScore, FinanceSubjectType } from './types.js'
import type { KycStatus, SanctionsStatus, RiskTier } from '@nzila/finance-compliance'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface CreateProfileInput {
  orgId: string
  subjectId: string
  subjectType: FinanceSubjectType
  displayName: string
  kycStatus?: KycStatus
  sanctionsStatus?: SanctionsStatus
  riskTier?: RiskTier
}

export function createProfile(input: CreateProfileInput): FinanceIdentityProfile {
  const now = new Date().toISOString()
  return {
    id: generateId(`identity:${input.orgId}:${input.subjectId}:${now}`),
    orgId: input.orgId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    displayName: input.displayName,
    kycStatus: input.kycStatus ?? 'not_started',
    sanctionsStatus: input.sanctionsStatus ?? 'not_screened',
    riskTier: input.riskTier ?? 'low',
    createdAt: now,
    updatedAt: now,
  }
}

export function updateRiskScore(profile: FinanceIdentityProfile, score: IdentityRiskScore): FinanceIdentityProfile {
  return {
    ...profile,
    riskTier: score.tier,
    updatedAt: new Date().toISOString(),
  }
}

export function isEligibleForTransactions(profile: FinanceIdentityProfile): boolean {
  return (
    profile.kycStatus === 'approved' &&
    profile.sanctionsStatus === 'clear' &&
    profile.riskTier !== 'critical'
  )
}
