/**
 * Live tax-reference freshness audit.
 *
 * This evaluates the recorded verification registry at a real instant.
 * It does not change lastVerified, and a fresh software test is not a
 * substitute for this result.
 */
import {
  DATA_VERSIONS,
  STALENESS_THRESHOLD_DAYS,
  parseVerificationDate,
  verificationAgeDays,
  type DataModuleVersion,
} from './data-versions'

export type TaxFreshnessClassification =
  | 'FRESH'
  | 'STALE'
  | 'INVALID'
  | 'FUTURE_CLAIM'
  | 'MISSING_SOURCE'

export type TaxReferenceCurrentness = 'CURRENT' | 'STALE' | 'UNVERIFIED'

export type TaxReleaseEligibility = 'ELIGIBLE' | 'BLOCKED' | 'RISK_DISPOSITIONED'

export interface TaxFreshnessModuleFinding {
  module: string
  taxYear: number | string | null
  lastVerified: string | null
  ageDays: number | null
  thresholdDays: number
  classification: TaxFreshnessClassification
  source: string | null
  requiredAction: string
}

export interface TaxReleaseDisposition {
  decisionId: string
  approver: string
  acceptedCurrentness: 'STALE' | 'UNVERIFIED'
  expiresOn: string
  scope: string[]
}

export interface TaxReferenceFreshnessAudit {
  schema: 'nzila-tax-reference-freshness/v1'
  status: 'TAX_REFERENCE_DATA_CURRENTNESS'
  currentness: TaxReferenceCurrentness
  evaluatedAt: string
  thresholdDays: number
  modules: TaxFreshnessModuleFinding[]
  releaseEligibility: TaxReleaseEligibility
  disposition: Pick<TaxReleaseDisposition, 'decisionId' | 'approver' | 'scope' | 'expiresOn'> | null
}

const ACTIONS: Record<TaxFreshnessClassification, string> = {
  FRESH: 'No re-verification is due under the 90-day threshold.',
  STALE: 'Re-verify this module against its authoritative source and record that new verification date.',
  INVALID: 'Replace the verification date with the real YYYY-MM-DD date of the source check. An invalid date is not verification.',
  FUTURE_CLAIM: 'Reject the future verification timestamp. A workflow must not invent a verification date.',
  MISSING_SOURCE: 'Record the authoritative source. A missing source is not verification.',
}

function classify(module: DataModuleVersion, asOf: Date): TaxFreshnessClassification {
  if (!module.module?.trim()) return 'INVALID'
  if (!module.source?.trim()) return 'MISSING_SOURCE'
  const age = verificationAgeDays(module.lastVerified, asOf)
  if (age === null) return 'INVALID'
  if (age < 0) return 'FUTURE_CLAIM'
  if (age > STALENESS_THRESHOLD_DAYS) return 'STALE'
  return 'FRESH'
}

function currentnessOf(findings: readonly TaxFreshnessModuleFinding[]): TaxReferenceCurrentness {
  if (findings.length === 0) return 'UNVERIFIED'
  if (findings.every((finding) => finding.classification === 'FRESH')) return 'CURRENT'
  if (findings.some((finding) => finding.classification !== 'STALE' && finding.classification !== 'FRESH')) {
    return 'UNVERIFIED'
  }
  return 'STALE'
}

export function assertDisposition(
  disposition: TaxReleaseDisposition,
  currentness: TaxReferenceCurrentness,
  asOf: Date,
): void {
  if (!disposition.decisionId?.trim()) throw new Error('DISPOSITION_DECISION_REQUIRED')
  if (!disposition.approver?.trim()) throw new Error('DISPOSITION_APPROVER_REQUIRED')
  if (!Array.isArray(disposition.scope) || disposition.scope.length === 0 || disposition.scope.some((item) => !item?.trim())) {
    throw new Error('DISPOSITION_SCOPE_REQUIRED')
  }
  if (disposition.acceptedCurrentness !== currentness) {
    throw new Error('DISPOSITION_CANNOT_CHANGE_CURRENTNESS')
  }
  if (!parseVerificationDate(disposition.expiresOn)) throw new Error('DISPOSITION_EXPIRED_OR_INVALID')
  if (asOf.toISOString().slice(0, 10) > disposition.expiresOn) {
    throw new Error('DISPOSITION_EXPIRED_OR_INVALID')
  }
}

export function auditTaxReferenceData(input?: {
  asOf?: Date
  modules?: readonly DataModuleVersion[]
  disposition?: TaxReleaseDisposition | null
}): TaxReferenceFreshnessAudit {
  const asOf = input?.asOf ?? new Date()
  const modules = input?.modules ?? DATA_VERSIONS
  const findings = modules.map((module): TaxFreshnessModuleFinding => {
    const classification = classify(module, asOf)
    const age = verificationAgeDays(module.lastVerified, asOf)
    return {
      module: module.module,
      taxYear: module.taxYear ?? null,
      lastVerified: module.lastVerified ?? null,
      ageDays: age,
      thresholdDays: STALENESS_THRESHOLD_DAYS,
      classification,
      source: module.source?.trim() ? module.source : null,
      requiredAction: ACTIONS[classification],
    }
  })
  const currentness = currentnessOf(findings)
  let releaseEligibility: TaxReleaseEligibility = currentness === 'CURRENT' ? 'ELIGIBLE' : 'BLOCKED'
  let recordedDisposition: TaxReferenceFreshnessAudit['disposition'] = null
  if (input?.disposition) {
    assertDisposition(input.disposition, currentness, asOf)
    if (currentness !== 'CURRENT') {
      releaseEligibility = 'RISK_DISPOSITIONED'
      recordedDisposition = {
        decisionId: input.disposition.decisionId.trim(),
        approver: input.disposition.approver.trim(),
        scope: input.disposition.scope.map((item) => item.trim()),
        expiresOn: input.disposition.expiresOn,
      }
    }
  }
  return {
    schema: 'nzila-tax-reference-freshness/v1',
    status: 'TAX_REFERENCE_DATA_CURRENTNESS',
    currentness,
    evaluatedAt: asOf.toISOString(),
    thresholdDays: STALENESS_THRESHOLD_DAYS,
    modules: findings,
    releaseEligibility,
    disposition: recordedDisposition,
  }
}
