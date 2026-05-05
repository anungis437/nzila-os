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
