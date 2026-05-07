/**
 * TrustCore — Core Type Definitions
 *
 * Base interfaces shared across all TrustCore modules.
 * Every record is org-scoped; every action is audit-trackable.
 */

// ── Roles ─────────────────────────────────────────────────────────────────

export type Role =
  | 'platform_admin'
  | 'org_admin'
  | 'compliance_officer'
  | 'security_officer'
  | 'privacy_officer'
  | 'legal_reviewer'
  | 'staff'
  | 'external_auditor'
  | 'auditor'
  | 'read_only'

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
// Single source of truth: @nzila/trustcore-core/compliance
// Re-exported here for ergonomics in app code.

export type {
  ComplianceStatus,
  RiskCategory,
  RiskSeverity,
  RiskItem,
  ComplianceEvaluation,
} from '@nzila/trustcore-core/compliance'

import type { ComplianceStatus } from '@nzila/trustcore-core/compliance'

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
