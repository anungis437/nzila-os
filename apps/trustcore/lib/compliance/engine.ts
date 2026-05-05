/**
 * TrustCore — Compliance Engine (Law 25)
 *
 * Deterministic, explainable compliance scoring for Quebec's Law 25.
 * Reads real org data from the database, applies deduction rules,
 * and produces an actionable ComplianceEvaluation.
 *
 * SCORING MODEL:
 *   - Score starts at 100.
 *   - Each category has an internal deduction cap to prevent score collapse.
 *   - Final score = 100 − sum(capped category deductions), floored at 0.
 *
 * CATEGORY CAPS (max deduction per category):
 *   Governance  −30 · Data  −25 · PIA  −20
 *   Incidents   −35 · DSR   −25 · Vendors −20
 *
 * STATUS THRESHOLDS:
 *   compliant     → score ≥ 85 AND no blocking risks
 *   at-risk       → score 60–84, OR blocking risks with score ≥ 60
 *   non-compliant → score < 60
 *
 * CONFIDENCE (0–100):
 *   Reflects data coverage. A score with low confidence is unreliable.
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
 * Prevents N+1 and keeps evaluation latency predictable.
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

// ── Category caps ──────────────────────────────────────────────────────────

const CATEGORY_CAPS = {
  governance: 30,
  data: 25,
  pia: 20,
  incidents: 35,
  dsr: 25,
  vendors: 20,
} as const

// ── Risk builder helper ────────────────────────────────────────────────────

function risk(
  id: string,
  category: RiskItem['category'],
  severity: RiskItem['severity'],
  message: string,
  recommendation: string,
  extras: Partial<Pick<RiskItem, 'blocking' | 'actionUrl' | 'effort' | 'slaDeadline' | 'evidenceRefs'>> = {},
): RiskItem {
  return {
    id,
    category,
    severity,
    message,
    recommendation,
    blocking: extras.blocking ?? false,
    ...extras,
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000

// ── Scoring rules ──────────────────────────────────────────────────────────

function evaluateGovernance(
  programs: TrustcorePrivacyProgram[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeProgram = programs.find((p) => p.status === 'active')

  if (!activeProgram) {
    risks.push(
      risk(
        'gov-no-program',
        'governance',
        'critical',
        'No active privacy program has been established.',
        'Create a Law 25 privacy program and set it to "active" before your next audit.',
        { blocking: true, actionUrl: '/compliance', effort: 'high' },
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
        { blocking: false, actionUrl: '/compliance', effort: 'low' },
      ),
    )
    deduction += 10
  }

  return Math.min(deduction, CATEGORY_CAPS.governance)
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
        { blocking: false, actionUrl: '/data-inventory', effort: 'high' },
      ),
    )
    deduction += 20
    return Math.min(deduction, CATEGORY_CAPS.data)
  }

  // High/critical assets without any PIA (org-level heuristic: no PIAs at all → gap)
  const hasPias = pias.length > 0
  const highCriticalAssets = activeAssets.filter(
    (a) => a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical',
  )

  if (highCriticalAssets.length > 0 && !hasPias) {
    risks.push(
      risk(
        'data-high-no-pia',
        'data',
        'high',
        `${highCriticalAssets.length} high/critical sensitivity asset(s) have no Privacy Impact Assessment on file.`,
        'Conduct a PIA for each high/critical sensitivity data asset and record it in the PIA module.',
        {
          blocking: false,
          actionUrl: '/pia',
          effort: 'high',
          evidenceRefs: highCriticalAssets.map((a) => a.id),
        },
      ),
    )
    deduction += Math.min(highCriticalAssets.length * 10, 25)
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
        {
          blocking: false,
          actionUrl: '/data-inventory',
          effort: 'low',
          evidenceRefs: crossBorderMissingCountry.map((a) => a.id),
        },
      ),
    )
    deduction += 10
  }

  return Math.min(deduction, CATEGORY_CAPS.data)
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
        { blocking: false, actionUrl: '/pia', effort: 'high' },
      ),
    )
    deduction += 15
    return Math.min(deduction, CATEGORY_CAPS.pia)
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
        {
          blocking: false,
          actionUrl: '/pia',
          effort: 'medium',
          evidenceRefs: mitigationRequired.map((p) => p.id),
        },
      ),
    )
    deduction += Math.min(mitigationRequired.length * 5, 15)
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
        {
          blocking: false,
          actionUrl: '/pia',
          effort: 'medium',
          evidenceRefs: highRiskNoMitigation.map((p) => p.id),
        },
      ),
    )
    deduction += Math.min(highRiskNoMitigation.length * 10, 20)
  }

  return Math.min(deduction, CATEGORY_CAPS.pia)
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
        {
          blocking: true,
          actionUrl: '/incidents',
          effort: 'high',
          evidenceRefs: openCritical.map((i) => i.id),
        },
      ),
    )
    deduction += Math.min(openCritical.length * 20, 30)
  }

  // Serious harm likely but not reported to CAI — includes SLA clock
  const unreportedSerious = incidents.filter(
    (i) => i.seriousHarmLikely && !i.reportedToCai,
  )
  if (unreportedSerious.length > 0) {
    // Find the most recent unreported incident to calculate urgency
    const mostRecent = unreportedSerious.reduce((a, b) =>
      a.dateDetected > b.dateDetected ? a : b,
    )
    const slaDeadline = new Date(
      mostRecent.dateDetected.getTime() + SEVENTY_TWO_HOURS_MS,
    ).toISOString()

    risks.push(
      risk(
        'incident-serious-not-reported',
        'incident',
        'critical',
        `${unreportedSerious.length} incident(s) with likely serious harm have not been reported to the CAI.`,
        "Law 25 requires reporting incidents with likely serious harm to the Commission d'accès à l'information within 72 hours. File the reports immediately.",
        {
          blocking: true,
          actionUrl: '/incidents',
          effort: 'high',
          slaDeadline,
          evidenceRefs: unreportedSerious.map((i) => i.id),
        },
      ),
    )
    deduction += Math.min(unreportedSerious.length * 25, 35)
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
        {
          blocking: false,
          actionUrl: '/incidents',
          effort: 'medium',
          evidenceRefs: stalledOpen.map((i) => i.id),
        },
      ),
    )
    deduction += Math.min(stalledOpen.length * 10, 20)
  }

  return Math.min(deduction, CATEGORY_CAPS.incidents)
}

function evaluateDsrRequests(
  dsrRequests: TrustcoreDsrRequest[],
  risks: RiskItem[],
): number {
  let deduction = 0

  // Overdue requests — SLA: Law 25 mandates 30-day response
  const overdue = dsrRequests.filter((r) => r.status === 'overdue')
  if (overdue.length > 0) {
    risks.push(
      risk(
        'dsr-overdue',
        'dsr',
        'critical',
        `${overdue.length} data subject rights request(s) are overdue.`,
        'Respond to all overdue DSR requests immediately. Law 25 mandates a 30-day response window; failure creates legal exposure.',
        {
          blocking: true,
          actionUrl: '/requests',
          effort: 'high',
          evidenceRefs: overdue.map((r) => r.id),
        },
      ),
    )
    deduction += Math.min(overdue.length * 15, 25)
  }

  // Active requests without identity verification
  const activeUnverified = dsrRequests.filter(
    (r) =>
      r.status !== 'completed' &&
      r.status !== 'denied' &&
      !r.identityVerified,
  )
  if (activeUnverified.length > 0) {
    risks.push(
      risk(
        'dsr-identity-not-verified',
        'dsr',
        'medium',
        `${activeUnverified.length} open DSR request(s) have not verified the requester's identity.`,
        "Verify requester identity before processing DSR requests to prevent unauthorized data disclosure.",
        {
          blocking: false,
          actionUrl: '/requests',
          effort: 'low',
          evidenceRefs: activeUnverified.map((r) => r.id),
        },
      ),
    )
    deduction += Math.min(activeUnverified.length * 5, 15)
  }

  return Math.min(deduction, CATEGORY_CAPS.dsr)
}

function evaluateVendors(
  vendors: TrustcoreVendor[],
  risks: RiskItem[],
): number {
  let deduction = 0
  const activeVendors = vendors.filter((v) => v.status === 'active')

  // High/critical-risk vendors without piaRequired=true
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
        {
          blocking: false,
          actionUrl: '/vendors',
          effort: 'medium',
          evidenceRefs: highRiskNoPia.map((v) => v.id),
        },
      ),
    )
    deduction += Math.min(highRiskNoPia.length * 10, 20)
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
        {
          blocking: false,
          actionUrl: '/vendors',
          effort: 'medium',
          evidenceRefs: crossBorderNoContract.map((v) => v.id),
        },
      ),
    )
    deduction += Math.min(crossBorderNoContract.length * 10, 20)
  }

  return Math.min(deduction, CATEGORY_CAPS.vendors)
}

// ── Confidence scoring ─────────────────────────────────────────────────────

/**
 * Estimate confidence in the score (0–100).
 * Low coverage → low confidence even if score is high.
 */
function computeConfidence(inputs: ComplianceInputs): number {
  let confidence = 100
  const activeAssets = inputs.assets.filter((a) => a.status === 'active').length

  // No privacy program → significant uncertainty
  if (!inputs.programs.some((p) => p.status === 'active')) confidence -= 25
  // No assets → very low coverage
  if (activeAssets === 0) confidence -= 30
  // No PIAs when assets exist → partial coverage
  if (inputs.pias.length === 0 && activeAssets > 0) confidence -= 20
  // No vendors registered → unknown third-party risk
  if (inputs.vendors.length === 0) confidence -= 10
  // No DSR requests ever → may mean process not in place
  if (inputs.dsrRequests.length === 0) confidence -= 5
  // No incidents ever logged → may indicate no process
  if (inputs.incidents.length === 0) confidence -= 5

  return Math.max(0, Math.min(100, confidence))
}

// ── Status derivation ──────────────────────────────────────────────────────

function deriveStatus(score: number, risks: RiskItem[]): ComplianceStatus {
  const hasBlocking = risks.some((r) => r.blocking)
  if (score >= 85 && !hasBlocking) return 'compliant'
  if (score >= 60) return 'at-risk'
  return 'non-compliant'
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate the full Law 25 compliance posture for an org.
 *
 * Pure and deterministic — identical inputs always produce identical outputs.
 * Call fetchComplianceInputs() to load the required data.
 */
export function evaluateComplianceFromInputs(
  orgId: string,
  inputs: ComplianceInputs,
): ComplianceEvaluation {
  const risks: RiskItem[] = []

  const govDeduction = evaluateGovernance(inputs.programs, risks)
  const dataDeduction = evaluateDataInventory(inputs.assets, inputs.pias, risks)
  const piaDeduction = evaluatePias(inputs.pias, inputs.assets, risks)
  const incidentDeduction = evaluateIncidents(inputs.incidents, risks)
  const dsrDeduction = evaluateDsrRequests(inputs.dsrRequests, risks)
  const vendorDeduction = evaluateVendors(inputs.vendors, risks)

  const totalDeduction =
    govDeduction +
    dataDeduction +
    piaDeduction +
    incidentDeduction +
    dsrDeduction +
    vendorDeduction

  const score = Math.max(0, Math.min(100, 100 - totalDeduction))
  const confidence = computeConfidence(inputs)
  const status = deriveStatus(score, risks)

  // Summary stats for dashboard consumption
  const openIncidents = inputs.incidents.filter(
    (i) => i.resolutionStatus === 'open' || i.resolutionStatus === 'contained',
  ).length
  const activeAssets = inputs.assets.filter((a) => a.status === 'active')
  const highCriticalAssets = activeAssets.filter(
    (a) => a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical',
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
    confidence,
    status,
    risks,
    summary: {
      totalAssets: activeAssets.length,
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

// ── Legacy shim ────────────────────────────────────────────────────────────

export interface ComplianceInput {
  verifiedControlIds: string[]
  applicableControlIds: string[]
  openRisks: string[]
}
