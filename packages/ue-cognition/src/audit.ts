/**
 * @nzila/ue-cognition/audit — Append-only audit trail for cognition outputs.
 *
 * Every score / recommendation / view / override is appended here so that
 * pilots can prove "the model said X at time T, with these inputs". This is
 * the governance counterweight to autonomous-looking outputs.
 */
import type { CognitionSubject } from '@nzila/platform-cognition-core'
import { ueCognitionAuditSchema } from './schemas'
import type { UECognitionAudit } from './types'
import { listRecords, makeId, nowISO, writeRecord } from './utils'

const ENTITY = 'audit'

export interface AuditInput {
  readonly subject: CognitionSubject
  readonly resource: UECognitionAudit['resource']
  readonly action: UECognitionAudit['action']
  readonly actorId: string | null
  readonly resourceId: string
  readonly details?: Readonly<Record<string, unknown>>
}

export function recordAudit(input: AuditInput): UECognitionAudit {
  const record: UECognitionAudit = {
    id: makeId('aud'),
    subject: input.subject,
    resource: input.resource,
    action: input.action,
    actorId: input.actorId,
    resourceId: input.resourceId,
    details: input.details ?? {},
    occurredAt: nowISO(),
  }
  return writeRecord(ENTITY, record.id, record, ueCognitionAuditSchema)
}

export function listAuditEntries(): UECognitionAudit[] {
  return listRecords(ENTITY, ueCognitionAuditSchema)
}
