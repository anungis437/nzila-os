/**
 * TrustCore — Compliance Engine (Law 25)
 *
 * Thin DB I/O wrapper. ALL scoring, risk derivation, status logic, category
 * caps, and confidence calculation live in `@nzila/trustcore-core/compliance`
 * (single source of truth). This module exists only to:
 *   1. Batch-load org compliance data from `@nzila/db`
 *   2. Delegate evaluation to `evaluateLaw25Compliance`
 *
 * Do NOT add scoring/derivation logic here. Extend the core package instead.
 */
import {
  evaluateLaw25Compliance,
  type Law25Inputs,
  type ComplianceEvaluation,
  type RiskItem,
  type RiskCategory,
  type RiskSeverity,
  type ComplianceStatus,
} from '@nzila/trustcore-core/compliance'
import {
  listTrustcorePrivacyPrograms,
  listTrustcoreDataAssets,
  listTrustcorePias,
  listTrustcoreIncidents,
  listTrustcoreDsrRequests,
  listTrustcoreVendors,
} from '@nzila/db/queries/trustcore'

export type ComplianceInputs = Law25Inputs
export type {
  ComplianceEvaluation,
  RiskItem,
  RiskCategory,
  RiskSeverity,
  ComplianceStatus,
}

/**
 * Batch-fetch all org compliance data needed by `evaluateLaw25Compliance`.
 * Runs the six list queries in parallel.
 */
export async function fetchComplianceInputs(orgId: string): Promise<ComplianceInputs> {
  const [programs, assets, pias, incidents, dsrRequests, vendors] = await Promise.all([
    listTrustcorePrivacyPrograms(orgId),
    listTrustcoreDataAssets(orgId),
    listTrustcorePias(orgId),
    listTrustcoreIncidents(orgId),
    listTrustcoreDsrRequests(orgId),
    listTrustcoreVendors(orgId),
  ])
  return { programs, assets, pias, incidents, dsrRequests, vendors }
}

/**
 * Evaluate compliance from already-loaded inputs (pure delegation to core).
 * Use when callers already have the inputs in hand (e.g. report generation).
 */
export const evaluateComplianceFromInputs = evaluateLaw25Compliance

/**
 * Convenience: fetch org data then evaluate.
 * Use this in API routes and server components.
 */
export async function evaluateCompliance(orgId: string): Promise<ComplianceEvaluation> {
  return evaluateLaw25Compliance(orgId, await fetchComplianceInputs(orgId))
}

// ── Legacy shim ────────────────────────────────────────────────────────────

export interface ComplianceInput {
  verifiedControlIds: string[]
  applicableControlIds: string[]
  openRisks: string[]
}
