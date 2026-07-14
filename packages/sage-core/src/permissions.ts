// ─── @nzila/sage-core — permission constants ─────────────────────────────────
// Exact permission strings enforced through @nzila/platform-auth (hasPermission).
// Do not spread raw string literals through services/tests — import these.

export const SAGE_PERMISSIONS = {
  WORKSPACE_CREATE: 'sage.workspace.create',
  WORKSPACE_READ: 'sage.workspace.read',
  WORKSPACE_ADMIN: 'sage.workspace.admin',
  MEMBER_MANAGE: 'sage.member.manage',
  ROLE_ASSIGN: 'sage.role.assign',
  ROLE_REVOKE: 'sage.role.revoke',
  EVIDENCE_CREATE: 'sage.evidence.create',
  EVIDENCE_CLASSIFY: 'sage.evidence.classify',
  EVIDENCE_LINK: 'sage.evidence.link',
  EVIDENCE_AUTHORIZATION_GRANT: 'sage.evidence_authorization.grant',
  EVIDENCE_AUTHORIZATION_REVOKE: 'sage.evidence_authorization.revoke',
  BOUNDARY_FLAG: 'sage.boundary.flag',
  REVIEW_NOTE: 'sage.review.note',
  DECISION_RECORD: 'sage.decision.record',
  EXPORT_REQUEST: 'sage.export.request',
  EXPORT_APPROVE: 'sage.export.approve',
  EXPORT_PACKAGE_GENERATE: 'sage.export.package.generate',
  EXPORT_DELIVERY_REQUEST: 'sage.export.delivery.request',
  EXPORT_DELIVERY_APPROVE: 'sage.export.delivery.approve',
  EXPORT_DELIVERY_REVOKE: 'sage.export.delivery.revoke',
  EXPORT_DELIVERY_READ: 'sage.export.delivery.read',
  // Phase 8B — records lifecycle (retention, legal holds, destruction). Each is
  // a narrow, distinct authority; generic platform/org admin never inherits any.
  EXPORT_RETENTION_ASSIGN: 'sage.export.retention.assign',
  EXPORT_LEGAL_HOLD_MANAGE: 'sage.export.legal_hold.manage',
  EXPORT_DESTRUCTION_REQUEST: 'sage.export.destruction.request',
  EXPORT_DESTRUCTION_APPROVE: 'sage.export.destruction.approve',
  EXPORT_DESTRUCTION_EXECUTE: 'sage.export.destruction.execute',
  EXPORT_DESTRUCTION_READ: 'sage.export.destruction.read',
} as const

export type SagePermission = (typeof SAGE_PERMISSIONS)[keyof typeof SAGE_PERMISSIONS]

export const SAGE_PERMISSION_VALUES: readonly SagePermission[] = Object.values(SAGE_PERMISSIONS)
