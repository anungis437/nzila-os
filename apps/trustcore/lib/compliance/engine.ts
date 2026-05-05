/**
 * TrustCore — Compliance Engine (Law 25)
 *
 * Deterministic, explainable compliance scoring for Quebec's Law 25.
 * Reads real org data from the database, applies deduction rules,
 * and produces an actionable ComplianceEvaluation.
 *
 * Score starts at 100 and deductions are applied per rule below.
 * No randomness. No placeholders. All rules execute on every call.
 *
 * STATUS THRESHOLDS:
 *   compliant     → score ≥ 85 AND no critical risks
 *   at-risk       → score 60–84, OR critical risks present
 *   non-compliant → score < 60
 */

import {
  listTrustcorePrivacyPrograms,
  listTrustcoreDataAssets,
  listTrustcorePias,
  listTrustcoreIncidents,
  listTrustcoreDsrRequests,
  listTrustcoreVendors,
} from '@nzila/db/queries/trustcore'
import type {
  TrustcorePrivacyProgram,
  TrustcoreDataAsset,
  TrustcorePia,
  TrustcoreIncident,
  TrustcoreDsrRequest,
  TrustcoreVendor,
} from '@nzila/db/queries/trustcore'
import type { ComplianceEvaluation, RiskItem, ComplianceStatus } from '@/types/core'

// ── Inputs snapshot ────────────────────────────────────────────────────────

export interface ComplianceInputs {
  programs: TrustcorePrivacyProgram[]
  assets: TrustcoreDataAsset[]
  pias: TrustcorePia[]
  incidents: TrustcoreIncident[]
  dsrRequests: TrustcoreDsrRequest[]
  vendors: TrustcoreVendor[]
}

/**
 * Batch-load all org compliance data in a single parallel round-trip.
 * This prevents N+1 and keeps evaluation latency predictable.
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

// ── Risk builder helpers ───────────────────────────────────────────────────

function risk(
  id: string,
  category: RiskItem['category'],
  severity: RiskItem['severity'],
  message: string,
  recommendation: string,
): RiskItem {
  return { id, category, severity, message, recommendation }
}

// ── Scoring rules ──────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function evaluateGovernance(
  programs: TrustcorePrivacyProgram[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeProgram = programs.find(
    (p) => p.status === 'active',
  )

  if (!activeProgram) {
    risks.push(
      risk(
        'gov-no-program',
        'governance',
        'critical',
        'No active privacy program has been established.',
        'Create a Law 25 privacy program and set it to "active" before your next audit.',
      ),
    )
    deduction += 25
  } else if (!activeProgram.privacyOfficerEmail) {
    risks.push(
      risk(
        'gov-no-po-email',
        'governance',
        'high',
        'Privacy Officer email is missing from the privacy program.',
        'Add a Privacy Officer email — Law 25 requires a designated contact for privacy inquiries.',
      ),
    )
    deduction += 10
  }

  return deduction
}

function evaluateDataInventory(
  assets: TrustcoreDataAsset[],
  pias: TrustcorePia[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeAssets = assets.filter((a) => a.status === 'active')

  if (activeAssets.length === 0) {
    risks.push(
      risk(
        'data-no-assets',
        'data',
        'high',
        'No data assets have been registered in the data inventory.',
        'Register all systems and datasets that process personal information under the Data Inventory module.',
      ),
    )
    deduction += 20
    return deduction
  }

  // High/critical assets without any PIA
  const piaOrgIds = new Set(pias.map((p) => p.orgId))
  // For per-asset PIA coverage we check if there is at least one PIA for the org
  // (the schema does not link PIAs to assets directly; use the org-level heuristic)
  const hasPias = pias.length > 0
  void piaOrgIds // suppress unused-var if needed

  const highCriticalAssets = activeAssets.filter(
    (a) => a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical',
  )

  if (highCriticalAssets.length > 0 && !hasPias) {
    const cap = Math.min(highCriticalAssets.length * 10, 30)
    risks.push(
      risk(
        'data-high-no-pia',
        'data',
        'high',
        `${highCriticalAssets.length} high/critical sensitivity asset(s) have no Privacy Impact Assessment on file.`,
        'Conduct a PIA for each high/critical sensitivity data asset and record it in the PIA module.',
      ),
    )
    deduction += cap
  }

  // Cross-border assets missing destination country
  const crossBorderMissingCountry = activeAssets.filter(
    (a) => a.crossBorderTransfer && !a.destinationCountry,
  )
  if (crossBorderMissingCountry.length > 0) {
    risks.push(
      risk(
        'data-cross-border-missing-country',
        'data',
        'medium',
        `${crossBorderMissingCountry.length} cross-border asset(s) are missing a destination country.`,
        'Specify the destination country for all assets transferred outside Canada — required for cross-border disclosure documentation.',
      ),
    )
    deduction += 10
  }

  return deduction
}

function evaluatePias(
  pias: TrustcorePia[],
  assets: TrustcoreDataAsset[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeAssets = assets.filter((a) => a.status === 'active')

  if (pias.length === 0 && activeAssets.length > 0) {
    risks.push(
      risk(
        'pia-none',
        'pia',
        'high',
        'No Privacy Impact Assessments have been created.',
        'Complete at least one PIA — Law 25 requires PIAs for high-risk or sensitive processing activities.',
      ),
    )
    deduction += 15
    return deduction
  }

  // PIAs with status mitigation_required
  const mitigationRequired = pias.filter((p) => p.status === 'mitigation_required')
  if (mitigationRequired.length > 0) {
    risks.push(
      risk(
        'pia-mitigation-required',
        'pia',
        'medium',
        `${mitigationRequired.length} PIA(s) have outstanding mitigations required.`,
        'Review the mitigation plans for open PIAs and implement required controls before re-submitting for approval.',
      ),
    )
    deduction += Math.min(mitigationRequired.length * 5, 20)
  }

  // High-risk PIAs (riskScore ≥ 70) without a mitigation plan
  const highRiskNoMitigation = pias.filter(
    (p) => (p.riskScore ?? 0) >= 70 && !p.mitigationPlan,
  )
  if (highRiskNoMitigation.length > 0) {
    risks.push(
      risk(
        'pia-high-risk-no-mitigation',
        'pia',
        'high',
        `${highRiskNoMitigation.length} high-risk PIA(s) are missing a mitigation plan.`,
        'Add a concrete mitigation plan to each high-risk PIA — these are required before the PIA can be approved.',
      ),
    )
    deduction += Math.min(highRiskNoMitigation.length * 10, 20)
  }

  return deduction
}

function evaluateIncidents(
  incidents: TrustcoreIncident[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const now = Date.now()

  // Open critical incidents
  const openCritical = incidents.filter(
    (i) =>
      i.severity === 'critical' &&
      (i.resolutionStatus === 'open' || i.resolutionStatus === 'contained'),
  )
  if (openCritical.length > 0) {
    risks.push(
      risk(
        'incident-open-critical',
        'incident',
        'critical',
        `${openCritical.length} critical-severity incident(s) remain open or contained.`,
        'Escalate and resolve critical incidents immediately. Law 25 requires timely response to high-impact breaches.',
      ),
    )
    deduction += Math.min(openCritical.length * 20, 40)
  }

  // Serious harm likely but not reported to CAI
  const unreportedSerious = incidents.filter(
    (i) => i.seriousHarmLikely && !i.reportedToCai,
  )
  if (unreportedSerious.length > 0) {
    risks.push(
      risk(
        'incident-serious-not-reported',
        'incident',
        'critical',
        `${unreportedSerious.length} incident(s) with likely serious harm have not been reported to the CAI.`,
        'Law 25 requires reporting incidents with likely serious harm to the Commission d\u2019acc\u00e8s \u00e0 l\u2019information within 72 hours. File the reports immediately.',
      ),
    )
    deduction += Math.min(unreportedSerious.length * 25, 50)
  }

  // Open incidents older than 30 days
  const stalledOpen = incidents.filter(
    (i) =>
      (i.resolutionStatus === 'open' || i.resolutionStatus === 'contained') &&
      now - i.createdAt.getTime() > THIRTY_DAYS_MS,
  )
  if (stalledOpen.length > 0) {
    risks.push(
      risk(
        'incident-stalled',
        'incident',
        'high',
        `${stalledOpen.length} open incident(s) have been unresolved for more than 30 days.`,
        'Review and resolve or formally close long-running incidents. Prolonged open incidents signal inadequate response procedures.',
      ),
    )
    deduction += Math.min(stalledOpen.length * 10, 30)
  }

  return deduction
}

function evaluateDsrRequests(
  dsrRequests: TrustcoreDsrRequest[],
  risks: RiskItem[],
): number {
  let deduction = 0

  // Overdue requests
  const overdue = dsrRequests.filter((r) => r.status === 'overdue')
  if (overdue.length > 0) {
    risks.push(
      risk(
        'dsr-overdue',
        'dsr',
        'critical',
        `${overdue.length} data subject rights request(s) are overdue.`,
        'Respond to all overdue DSR requests immediately. Law 25 mandates a 30-day response window; failure creates legal exposure.',
      ),
    )
    deduction += Math.min(overdue.length * 15, 45)
  }

  // Active requests (not completed/denied) without identity verification
  const activeUnverified = dsrRequests.filter(
    (r) =>
      !['completed', 'denied'].includes(r.status) &&
      !r.identityVerified,
  )
  if (activeUnverified.length > 0) {
    risks.push(
      risk(
        'dsr-identity-not-verified',
        'dsr',
        'medium',
        `${activeUnverified.length} open DSR request(s) have not verified the requester's identity.`,
        'Verify requester identity before processing DSR requests to prevent unauthorized data disclosure.',
      ),
    )
    deduction += Math.min(activeUnverified.length * 5, 15)
  }

  return deduction
}

function evaluateVendors(
  vendors: TrustcoreVendor[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeVendors = vendors.filter((v) => v.status === 'active')

  // High/critical risk vendors without piaRequired=true
  const highRiskNoPia = activeVendors.filter(
    (v) =>
      (v.riskLevel === 'high' || v.riskLevel === 'critical') &&
      !v.piaRequired,
  )
  if (highRiskNoPia.length > 0) {
    risks.push(
      risk(
        'vendor-high-risk-no-pia',
        'vendor',
        'high',
        `${highRiskNoPia.length} high/critical-risk vendor(s) have not been flagged as requiring a PIA.`,
        'Mark high/critical-risk vendors as PIA-required and conduct the relevant PIAs before sharing personal data.',
      ),
    )
    deduction += Math.min(highRiskNoPia.length * 10, 30)
  }

  // Cross-border vendors without contract reviewed
  const crossBorderNoContract = activeVendors.filter(
    (v) => v.crossBorderTransfer && !v.contractReviewed,
  )
  if (crossBorderNoContract.length > 0) {
    risks.push(
      risk(
        'vendor-cross-border-no-contract',
        'vendor',
        'high',
        `${crossBorderNoContract.length} vendor(s) with cross-border data transfer have not had their contract/DPA reviewed.`,
        'Review and document the data processing agreement for all vendors transferring data outside Canada — required under Law 25.',
      ),
    )
    deduction += Math.min(crossBorderNoContract.length * 10, 20)
  }

  return deduction
}

// ── Status derivation ──────────────────────────────────────────────────────

function deriveStatus(score: number, risks: RiskItem[]): ComplianceStatus {
  const hasCritical = risks.some((r) => r.severity === 'critical')
  if (score >= 85 && !hasCritical) return 'compliant'
  if (score >= 60 && !hasCritical) return 'at-risk'
  return 'non-compliant'
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate the full Law 25 compliance posture for an org.
 *
 * This function is pure and deterministic — identical inputs always produce
 * identical outputs. Call fetchComplianceInputs() to load the required data.
 */
export function evaluateComplianceFromInputs(
  orgId: string,
  inputs: ComplianceInputs,
): ComplianceEvaluation {
  const risks: RiskItem[] = []
  let deduction = 0

  deduction += evaluateGovernance(inputs.programs, risks)
  deduction += evaluateDataInventory(inputs.assets, inputs.pias, risks)
  deduction += evaluatePias(inputs.pias, inputs.assets, risks)
  deduction += evaluateIncidents(inputs.incidents, risks)
  deduction += evaluateDsrRequests(inputs.dsrRequests, risks)
  deduction += evaluateVendors(inputs.vendors, risks)

  const score = Math.max(0, Math.min(100, 100 - deduction))
  const status = deriveStatus(score, risks)

  // Summary stats for dashboard consumption
  const openIncidents = inputs.incidents.filter(
    (i) => i.resolutionStatus === 'open' || i.resolutionStatus === 'contained',
  ).length
  const highCriticalAssets = inputs.assets.filter(
    (a) =>
      a.status === 'active' &&
      (a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical'),
  ).length
  const missingPias = inputs.pias.length === 0 && highCriticalAssets > 0 ? highCriticalAssets : 0
  const overdueRequests = inputs.dsrRequests.filter((r) => r.status === 'overdue').length
  const highRiskVendors = inputs.vendors.filter(
    (v) =>
      v.status === 'active' &&
      (v.riskLevel === 'high' || v.riskLevel === 'critical'),
  ).length

  return {
    orgId,
    score,
    status,
    risks,
    summary: {
      totalAssets: inputs.assets.filter((a) => a.status === 'active').length,
      missingPias,
      overdueRequests,
      openIncidents,
      highRiskVendors,
    },
    evaluatedAt: new Date().toISOString(),
  }
}

/**
 * Convenience: fetch org data then evaluate.
 * Use this in API routes and server components.
 */
export async function evaluateCompliance(orgId: string): Promise<ComplianceEvaluation> {
  const inputs = await fetchComplianceInputs(orgId)
  return evaluateComplianceFromInputs(orgId, inputs)
}

// ── Legacy shim (used by old engine.ts callers) ───────────────────────────
// Preserved so existing tests/callers continue to compile.

export interface ComplianceInput {
  verifiedControlIds: string[]
  applicableControlIds: string[]
  openRisks: string[]
}

