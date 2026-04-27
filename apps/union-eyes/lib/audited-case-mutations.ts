/**
 * Audited Case Mutations
 *
 * Thin wrapper around auditDataMutation() that normalises CUPE case events
 * into a consistent schema for evidence export and timeline rendering.
 *
 * PR-030: Audited Writes Completion Across Critical Mutations
 */

import { auditDataMutation, AuditSeverity, auditLog } from './audit-logger';

// ---------------------------------------------------------------------------
// Event types for case domain
// ---------------------------------------------------------------------------

export const CaseAuditEvent = {
  CASE_CREATED: 'case.created',
  CASE_TRANSITIONED: 'case.transitioned',
  CASE_ASSIGNED: 'case.assigned',
  CASE_ACCESS_GRANTED: 'case.access_granted',
  CASE_ACCESS_UPDATED: 'case.access_updated',
  CASE_ACCESS_REVOKED: 'case.access_revoked',
  CASE_ACCESS_EXPIRED: 'case.access_expired',
  CASE_REASSIGNED: 'case.reassigned',
  CASE_NOTE_ADDED: 'case.note_added',
  CASE_ATTACHMENT_UPLOADED: 'case.attachment_uploaded',
  DOCUMENT_LABEL_CHANGED: 'document.label_changed',
  CASE_ATTACHMENT_DELETED: 'case.attachment_deleted',
  CASE_CLOSED: 'case.closed',
  CASE_REOPENED: 'case.reopened',
  CASE_EVIDENCE_EXPORTED: 'case.evidence_exported',
} as const;

export type CaseAuditEventType = (typeof CaseAuditEvent)[keyof typeof CaseAuditEvent];

// ---------------------------------------------------------------------------
// Unified case mutation audit
// ---------------------------------------------------------------------------

export interface CaseMutationAuditParams {
  event: CaseAuditEventType;
  userId: string;
  organizationId: string;
  caseId: string;
  action: 'create' | 'update' | 'delete';
  /** Before-state snapshot (for transitions, assignments) */
  previousState?: Record<string, unknown>;
  /** After-state snapshot */
  newState?: Record<string, unknown>;
  /** Free-form context (reason, note ID, file name, etc.) */
  details?: Record<string, unknown>;
}

/**
 * Record a CUPE case mutation to the audit trail.
 *
 * Delegates to `auditDataMutation()` with additional
 * case-domain metadata so evidence export can query on
 * `metadata.event` reliably.
 */
export async function auditCaseMutation(p: CaseMutationAuditParams): Promise<void> {
  return auditDataMutation({
    userId: p.userId,
    organizationId: p.organizationId,
    resource: 'claims',
    resourceId: p.caseId,
    action: p.action,
    previousState: p.previousState,
    newState: p.newState,
    details: {
      event: p.event,
      caseId: p.caseId,
      ...p.details,
    },
  });
}

/**
 * Record a case evidence export event. Read-only, but compliance-relevant.
 */
export async function auditCaseExport(p: {
  userId: string;
  organizationId: string;
  caseId: string;
  format: 'json' | 'zip' | 'pdf';
}): Promise<void> {
  return auditLog({
    eventType: CaseAuditEvent.CASE_EVIDENCE_EXPORTED,
    severity: AuditSeverity.HIGH,
    userId: p.userId,
    organizationId: p.organizationId,
    resource: 'claims',
    resourceId: p.caseId,
    action: 'export',
    details: {
      event: CaseAuditEvent.CASE_EVIDENCE_EXPORTED,
      format: p.format,
    },
    outcome: 'success',
  });
}
