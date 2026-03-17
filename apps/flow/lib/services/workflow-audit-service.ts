/**
 * ShopMoiCa Workflow Audit Events
 *
 * Structured audit event emission for all quote workflow transitions,
 * customer approval actions, payment gating, and order lifecycle events.
 *
 * Wires into the existing @nzila/commerce-audit evidence pipeline.
 */
import { auditQuoteTransition, buildQuoteEvidencePack } from '@/lib/evidence'
import { logAuditTrail } from '@/lib/commerce-telemetry'
import { logger } from '@/lib/logger'
import type { WorkflowAuditEvent } from '@/lib/schemas/workflow-schemas'

export interface AuditEventInput {
  event: WorkflowAuditEvent
  quoteId: string
  orgId: string
  userId: string
  metadata?: Record<string, unknown>
}

/**
 * Emit a workflow audit event.
 * Creates an audit trail entry and logs via observability pipeline.
 */
export function emitWorkflowAuditEvent(input: AuditEventInput): void {
  const { event, quoteId, orgId, userId, metadata } = input

  // Build audit entry via commerce-audit
  const _auditEntry = auditQuoteTransition({
    quoteId,
    fromStatus: metadata?.fromStatus as string ?? event,
    toStatus: metadata?.toStatus as string ?? event,
    userId,
    orgId,
  })

  // Log via observability pipeline
  logAuditTrail(
    { orgId, actorId: userId },
    'quote',
    event,
    orgId,
  )

  logger.info('Workflow audit event emitted', {
    event,
    quoteId,
    orgId,
    userId,
  })
}

/**
 * Build and seal an evidence pack for a workflow event.
 */
export async function buildWorkflowEvidencePack(input: {
  event: WorkflowAuditEvent
  quoteId: string
  orgId: string
  userId: string
}) {
  return buildQuoteEvidencePack({
    orgId: input.orgId,
    entityType: 'quote' as never,
    targetEntityId: input.quoteId,
    triggerEvent: input.event,
    actorId: input.userId,
    auditTrail: [],
  })
}
