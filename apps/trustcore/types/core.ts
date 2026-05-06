/**
 * TrustCore — Core Type Definitions
 *
 * Base interfaces shared across all TrustCore modules.
 * Every record is org-scoped; every action is audit-trackable.
 */

// ── Roles ─────────────────────────────────────────────────────────────────

export type Role = 'platform_admin' | 'org_admin' | 'staff' | 'auditor'

// ── Org-scoped entity base ────────────────────────────────────────────────

export interface OrgScopedEntity {
  id: string
  orgId: string
  createdAt: string
  updatedAt: string
}

// ── Audit / Evidence ──────────────────────────────────────────────────────

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'exported'
  | 'submitted'
  | 'escalated'
  // TrustCore domain-specific actions
  | 'data_asset_created'
  | 'pia_created'
  | 'incident_logged'
  | 'dsr_created'
  | 'vendor_added'

export interface AuditEvent {
  id: string
  orgId: string
  actorId: string
  entityType: string
  entityId: string
  action: AuditAction
  metadata?: Record<string, unknown>
  occurredAt: string
}

// ── Compliance ────────────────────────────────────────────────────────────

export type ComplianceStatus = 'compliant' | 'at-risk' | 'non-compliant'

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
  /**
   * ISO 8601 deadline imposed by Law 25 (e.g., CAI 72-hour reporting window).
   * Undefined when no statutory deadline applies.
   */
  slaDeadline?: string
  /**
   * IDs of evidence events or entity records that support this risk finding.
   * Allows auditors to trace from risk → raw log.
   */
  evidenceRefs?: string[]
}

export interface ComplianceEvaluation {
  orgId: string
  score: number
  /**
   * Confidence in the score (0–100).
   * Low when few modules have been populated (e.g., no assets, no PIAs).
   * A low-confidence high score does not indicate real compliance.
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

/** @deprecated Use ComplianceEvaluation — kept for backward compat */
export interface ComplianceResult {
  orgId: string
  score: number
  risks: string[]
  status: ComplianceStatus
  evaluatedAt: string
}

// ── Auth context ──────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  orgId: string
  role: Role
}
