import { createHash } from 'node:crypto'
import type { AgriOrgRole } from './enums'
import type { AgriAuditEntry } from './types/index'

export function buildActionAuditEntry(input: {
  id: string
  orgId: string
  actorId: string
  role: AgriOrgRole
  entityType: string
  targetEntityId: string
  action: string
  label: string
  metadata: Record<string, unknown>
}): AgriAuditEntry {
  const timestamp = new Date().toISOString()
  const hashPayload = JSON.stringify({
    id: input.id,
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    targetEntityId: input.targetEntityId,
    timestamp,
  })
  const hash = createHash('sha256').update(hashPayload).digest('hex')

  return {
    id: input.id,
    orgId: input.orgId,
    actorId: input.actorId,
    role: input.role,
    entityType: input.entityType,
    targetEntityId: input.targetEntityId,
    action: input.action,
    label: input.label,
    metadata: input.metadata,
    hash,
    timestamp,
  }
}

export function hashAuditEntry(entry: AgriAuditEntry, previousHash: string | null): string {
  const data = JSON.stringify({ entry, previousHash })
  return createHash('sha256').update(data).digest('hex')
}
