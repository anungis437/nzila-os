/**
 * Flow — Audit Dispatcher
 *
 * Writes audit metadata for every critical mutation.
 * Bridges into the shared @nzila/commerce-audit system when available,
 * otherwise writes to the timeline repo as the audit record.
 */
import { timelineRepo } from '@/lib/repositories/workflow-repository'
import { logger } from '@/lib/logger'

export interface AuditEntry {
  org_id: string
  actor_id: string
  entity_type: string
  entity_id: string
  action: string
  status_before?: string
  status_after?: string
  metadata?: Record<string, unknown>
  correlation_id?: string
}

export async function dispatchAuditEntry(entry: AuditEntry): Promise<string> {
  const auditRef = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Write to timeline as canonical audit trail
  await timelineRepo.add({
    orgId: entry.org_id,
    quoteId: entry.entity_id, // timeline repo uses quoteId as entity key
    event: entry.action,
    description: buildAuditDescription(entry),
    actor: entry.actor_id,
    metadata: {
      audit_ref: auditRef,
      entity_type: entry.entity_type,
      status_before: entry.status_before,
      status_after: entry.status_after,
      correlation_id: entry.correlation_id,
      ...entry.metadata,
    },
  })

  logger.info('Audit entry dispatched', {
    auditRef,
    action: entry.action,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
  })

  return auditRef
}

function buildAuditDescription(entry: AuditEntry): string {
  const parts = [`${entry.action} on ${entry.entity_type} ${entry.entity_id}`]
  if (entry.status_before && entry.status_after) {
    parts.push(`(${entry.status_before} → ${entry.status_after})`)
  }
  if (entry.actor_id) {
    parts.push(`by ${entry.actor_id}`)
  }
  return parts.join(' ')
}
