// ─── @nzila/sage-core — audit-event contract ─────────────────────────────────
// SAGE integrates with @nzila/audit; it does NOT create a parallel audit log.
// Every material SAGE action maps to a `sage.*` action constant and a `sage_*`
// resource. buildSageAuditPayload produces an AuditInput-shaped object
// (actorId, orgId, action, resource, resourceId, payload) for @nzila/audit.

export const SAGE_AUDIT_ACTIONS = {
  WORKSPACE_CREATED: 'sage.workspace.created',
  MEMBER_ADDED: 'sage.member.added',
  ROLE_ASSIGNED: 'sage.role.assigned',
  ROLE_REVOKED: 'sage.role.revoked',
  EVIDENCE_AUTHORIZATION_GRANTED: 'sage.evidence_authorization.granted',
  EVIDENCE_AUTHORIZATION_REVOKED: 'sage.evidence_authorization.revoked',
  EXPORT_AUTHORITY_SET: 'sage.export_authority.set',
  EVIDENCE_SOURCE_CREATED: 'sage.evidence_source.created',
  SOURCE_CLASSIFIED: 'sage.source.classified',
  EVIDENCE_ITEM_CREATED: 'sage.evidence_item.created',
  EVIDENCE_LINKED: 'sage.evidence.linked',
  BOUNDARY_FLAGGED: 'sage.boundary.flagged',
  BOUNDARY_REVIEWED: 'sage.boundary.reviewed',
  BOUNDARY_RESOLVED: 'sage.boundary.resolved',
  REVIEW_NOTED: 'sage.review.noted',
  DECISION_RECORDED: 'sage.decision.recorded',
  EXPORT_REQUESTED: 'sage.export.requested',
  EXPORT_APPROVED: 'sage.export.approved',
  EXPORT_DENIED: 'sage.export.denied',
  EXPORT_PACKAGE_GENERATED: 'sage.export.package_generated',
  EXPORT_PACKAGE_ACCESS_AUTHORIZED: 'sage.export.package_access_authorized',
  EXPORT_PACKAGE_ACCESSED: 'sage.export.package_accessed',
  EXPORT_PACKAGE_ACCESS_DENIED: 'sage.export.package_access_denied',
} as const

export type SageAuditAction = (typeof SAGE_AUDIT_ACTIONS)[keyof typeof SAGE_AUDIT_ACTIONS]

export const SAGE_AUDIT_ACTION_VALUES: readonly SageAuditAction[] = Object.values(SAGE_AUDIT_ACTIONS)

export const SAGE_AUDIT_RESOURCES = {
  WORKSPACE: 'sage_workspace',
  WORKSPACE_MEMBER: 'sage_workspace_member',
  STAKEHOLDER_PROFILE: 'sage_stakeholder_profile',
  ROLE_ASSIGNMENT: 'sage_role_assignment',
  EVIDENCE_AUTHORIZATION: 'sage_evidence_authorization',
  EVIDENCE_SOURCE: 'sage_evidence_source',
  EVIDENCE_ITEM: 'sage_evidence_item',
  BOUNDARY_FLAG: 'sage_boundary_flag',
  REVIEW_NOTE: 'sage_review_note',
  DECISION_RECORD: 'sage_decision_record',
  EXPORT_REQUEST: 'sage_export_request',
  EXPORT_APPROVAL: 'sage_export_approval',
  EXPORT_PACKAGE: 'sage_export_package',
} as const

export type SageAuditResource = (typeof SAGE_AUDIT_RESOURCES)[keyof typeof SAGE_AUDIT_RESOURCES]

export const SAGE_AUDIT_RESOURCE_VALUES: readonly SageAuditResource[] =
  Object.values(SAGE_AUDIT_RESOURCES)

// Shape compatible with @nzila/audit AuditInput (before hashing).
export type SageAuditPayload = {
  actorId: string
  orgId: string
  action: SageAuditAction
  resource: SageAuditResource
  resourceId?: string
  payload: Record<string, unknown>
}

export function buildSageAuditPayload(input: {
  actorId: string
  orgId: string
  action: SageAuditAction
  resource: SageAuditResource
  resourceId?: string
  payload?: Record<string, unknown>
}): SageAuditPayload {
  if (!input.actorId) throw new Error('SAGE audit payload requires actorId')
  if (!input.orgId) throw new Error('SAGE audit payload requires orgId')
  if (!SAGE_AUDIT_ACTION_VALUES.includes(input.action)) {
    throw new Error(`Unknown SAGE audit action: ${input.action}`)
  }
  if (!SAGE_AUDIT_RESOURCE_VALUES.includes(input.resource)) {
    throw new Error(`Unknown SAGE audit resource: ${input.resource}`)
  }
  return {
    actorId: input.actorId,
    orgId: input.orgId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    payload: input.payload ?? {},
  }
}
