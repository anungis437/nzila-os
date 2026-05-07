/**
 * Law 25 compliance type contracts.
 *
 * These mirror — and are the canonical home of — the previous in-app
 * `apps/trustcore/types/core.ts` compliance types. The app re-exports them
 * for backwards compatibility so consumers that import from `@/types/core`
 * keep working unchanged.
 *
 * The evaluator inputs (`Law25Inputs`) are STRUCTURAL — they list only the
 * fields the deduction rules read, so this module remains free of any DB
 * driver / schema dependency and stays pure-function testable.
 */

export type ComplianceStatus = 'compliant' | 'at-risk' | 'non-compliant'

/**
 * Risk category as emitted by the in-app Law 25 compliance evaluators.
 *
 * NOTE: deliberately uses the SINGULAR form for `incident` and `vendor`
 * — the same shape the existing app and PDF/report layers depend on.
 * The TrustCore risk register (`@nzila/trustcore-core/risks`) uses the
 * PLURAL form (`incidents`, `vendors`) for register categories; the
 * trust-engine layer maps between the two.
 */
export type RiskCategory = 'governance' | 'data' | 'pia' | 'incident' | 'dsr' | 'vendor'

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface RiskItem {
  /** Stable identifier for deduplication (deterministic, based on rule). */
  id: string
  category: RiskCategory
  severity: RiskSeverity
  message: string
  recommendation: string
  /**
   * When true this risk blocks audit readiness regardless of score.
   * Examples: unreported serious-harm incident, overdue DSR request.
   */
  blocking: boolean
  /** Deep-link to the TrustCore module where the user should act. */
  actionUrl?: string
  /** Rough effort estimate to resolve this risk. */
  effort?: 'low' | 'medium' | 'high'
  /** ISO 8601 deadline imposed by Law 25 (e.g., CAI 72-hour window). */
  slaDeadline?: string
  /** IDs of evidence events or entity records that support this finding. */
  evidenceRefs?: string[]
}

export interface ComplianceEvaluation {
  orgId: string
  score: number
  /**
   * Confidence in the score (0–100). Low when few modules have been
   * populated. A low-confidence high score does not indicate compliance.
   */
  confidence: number
  status: ComplianceStatus
  risks: RiskItem[]
  summary: {
    totalAssets: number
    missingPias: number
    overdueRequests: number
    openIncidents: number
    highRiskVendors: number
  }
  evaluatedAt: string
}

// ── Structural evaluator inputs ───────────────────────────────────────────
//
// Each interface declares ONLY the fields the deduction rules read.
// This intentionally decouples the pure evaluators from drizzle inferred
// types so the package remains testable without a database.

export interface PrivacyProgramInput {
  status: 'draft' | 'active' | 'needs_review'
  privacyOfficerEmail: string | null
  privacyOfficerName?: string | null
}

export interface DataAssetInput {
  id: string
  status: 'active' | 'archived' | 'needs_review'
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical'
  crossBorderTransfer: boolean
  destinationCountry: string | null
}

export interface PiaInput {
  id: string
  status:
    | 'draft'
    | 'in_review'
    | 'approved'
    | 'rejected'
    | 'mitigation_required'
  riskScore: number | null
  mitigationPlan: string | null
}

export interface IncidentInput {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolutionStatus: 'open' | 'contained' | 'resolved' | 'closed'
  seriousHarmLikely: boolean
  reportedToCai: boolean
  dateDetected: Date
  createdAt: Date
}

export interface DsrRequestInput {
  id: string
  status:
    | 'received'
    | 'verifying_identity'
    | 'in_progress'
    | 'completed'
    | 'denied'
    | 'overdue'
  identityVerified: boolean
}

export interface VendorInput {
  id: string
  status: 'active' | 'pending_review' | 'suspended' | 'archived'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  piaRequired: boolean
  crossBorderTransfer: boolean
  contractReviewed: boolean
}

export interface Law25Inputs {
  programs: PrivacyProgramInput[]
  assets: DataAssetInput[]
  pias: PiaInput[]
  incidents: IncidentInput[]
  dsrRequests: DsrRequestInput[]
  vendors: VendorInput[]
}

// ── Category caps (Law 25) ────────────────────────────────────────────────

export const LAW25_CATEGORY_CAPS = {
  governance: 30,
  data: 25,
  pia: 20,
  incidents: 35,
  dsr: 25,
  vendors: 20,
} as const

// ── Constants ──────────────────────────────────────────────────────────────

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
export const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000

// ── Dashboard summary (structural) ────────────────────────────────────────

export interface DashboardSummary {
  orgId: string
  complianceScore: number
  openRisks: number
  pendingRequests: number
  incidentAlerts: number
  auditReadinessStatus: 'ready' | 'partial' | 'not_ready'
  evaluatedAt: string
}
