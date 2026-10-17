import { randomUUID } from 'node:crypto'
import { recordRestrictedAudit } from './audit'
import { readRestrictedRecord } from './principal'
import { getState } from './state'
import { PlaneError, type Actor, type DeletionRecord, type LegalHold, type RetentionStatement } from './types'

const BACKUP_POLICY_MAX_DAYS = 90

export function stateRetention(input: {
  category: string
  policyId: string
  rationale: string
  reviewDate: string
  durationDays: number | null
  preservationRequired?: boolean
}): RetentionStatement {
  if (!input.category.trim() || !input.policyId.trim() || !input.rationale.trim() || !input.reviewDate.trim()) {
    throw new PlaneError(
      'RETENTION_STATEMENT_INCOMPLETE',
      'Retention requires category, policy id, rationale, and review date.',
    )
  }
  if (input.category.toLowerCase().includes('civitas') && input.durationDays != null) {
    throw new PlaneError(
      'CIVITAS_DURATION_NOT_INVENTED',
      'This plane does not invent a CIVITAS retention duration.',
    )
  }
  if (input.durationDays !== null && (!Number.isSafeInteger(input.durationDays) || input.durationDays < 0)) {
    throw new PlaneError('INVALID_RETENTION_DURATION', 'A retention duration must be a finite non-negative whole number or explicitly unassigned.')
  }
  const statement: RetentionStatement = {
    category: input.category,
    policyId: input.policyId,
    rationale: input.rationale,
    reviewDate: input.reviewDate,
    archivalState: input.durationDays == null ? 'pending_review' : 'active',
    deletionEligible: false,
    preservationRequired: input.preservationRequired === true,
    durationDays: input.durationDays,
  }
  if (input.durationDays != null) {
    statement.deletionEligible = !statement.preservationRequired
  }
  getState().retention.set(statement.category, statement)
  return structuredClone(statement)
}

function holdCovers(hold: LegalHold, orgId: string, principalId: string, recordId: string, category: string, now: Date): boolean {
  if (hold.releasedAt) return false
  if (Date.parse(hold.start) > now.getTime() || Date.parse(hold.expiresAt) <= now.getTime()) return false
  if (hold.scope.orgId !== orgId) return false
  if (hold.scope.principalId && hold.scope.principalId !== principalId) return false
  if (hold.scope.resourceId && hold.scope.resourceId !== recordId) return false
  if (hold.scope.category && hold.scope.category !== category) return false
  return true
}

export function placeLegalHold(input: {
  scope: LegalHold['scope']
  reason: string
  authorityRef: string
  authorityKind: 'platform_legal' | 'platform_privacy' | 'application' | 'civitas'
  reviewer: string
  start: string
  reviewDue: string
  expiresAt: string
}): LegalHold {
  if (input.authorityKind !== 'platform_legal' && input.authorityKind !== 'platform_privacy') {
    throw new PlaneError(
      'HOLD_AUTHORITY_REQUIRED',
      'An application, including CIVITAS, cannot declare a legal hold. Platform legal or privacy authority is required.',
    )
  }
  if (!input.reason.trim() || !input.authorityRef.trim() || !input.reviewer.trim()) {
    throw new PlaneError('HOLD_INCOMPLETE', 'A legal hold requires reason, authority reference, and reviewer.')
  }
  if (!input.reviewDue || !input.expiresAt) {
    throw new PlaneError('HOLD_NOT_INDEFINITE', 'A legal hold requires a review date and an expiry. Indefinite invisible retention is rejected.')
  }
  const dates = [input.start, input.reviewDue, input.expiresAt].map(Date.parse)
  if (!input.scope.orgId?.trim() || dates.some((time) => !Number.isFinite(time)) || dates[0]! > dates[1]! || dates[1]! > dates[2]! || dates[0]! >= dates[2]!) {
    throw new PlaneError('HOLD_INVALID_SCOPE_OR_DATES', 'A legal hold requires an organization and ordered finite start, review and expiry dates.')
  }
  const hold: LegalHold = {
    id: randomUUID(),
    scope: structuredClone(input.scope),
    reason: input.reason.trim(),
    authorityRef: input.authorityRef.trim(),
    authorityKind: input.authorityKind,
    reviewer: input.reviewer,
    start: input.start,
    reviewDue: input.reviewDue,
    expiresAt: input.expiresAt,
  }
  getState().holds.push(hold)
  return structuredClone(hold)
}

export function releaseLegalHold(holdId: string, release: { releasedBy: string; releaseEvent: string }): LegalHold {
  const hold = getState().holds.find((item) => item.id === holdId)
  if (!hold) throw new PlaneError('HOLD_NOT_FOUND', 'Legal hold was not found.')
  if (!release.releaseEvent.trim() || !release.releasedBy.trim()) {
    throw new PlaneError('HOLD_RELEASE_REQUIRED', 'Releasing a hold requires a release event and a person.')
  }
  hold.releasedAt = new Date().toISOString()
  hold.releaseEvent = `${release.releasedBy}: ${release.releaseEvent.trim()}`
  return structuredClone(hold)
}

export function deleteRestrictedRecord(input: {
  orgId: string
  principalId: string
  recordId: string
  actor: Actor
  purpose: string
  authorizationBasis: string
}): DeletionRecord {
  const now = new Date()
  if (!Number.isFinite(now.getTime())) throw new PlaneError('INVALID_ACCESS_TIME', 'Deletion requires a valid time.')
  const record = getState().records.get(input.recordId)
  if (!record || record.orgId !== input.orgId || record.principalId !== input.principalId) {
    throw new PlaneError('NOT_FOUND', 'Restricted record is not in this principal scope.')
  }
  if (input.actor.kind !== 'principal' || input.actor.id !== record.principalId) {
    throw new PlaneError('PRINCIPAL_DELETE_REQUIRED', 'Only the owning principal may delete this Restricted record; read and export grants do not confer deletion.')
  }
  if (getState().retention.get(record.category)?.preservationRequired) {
    throw new PlaneError('PRESERVATION_REQUIRED', 'The declared category retention statement requires preservation.')
  }
  const blocked = getState().holds.find((hold) => holdCovers(hold, input.orgId, input.principalId, input.recordId, record.category, now))
  if (blocked) {
    throw new PlaneError('PRESERVATION_REQUIRED', `Legal hold ${blocked.id} preserves this record until ${blocked.expiresAt}.`)
  }
  recordRestrictedAudit({
    actorId: input.actor.id,
    serviceOrAgent: input.actor.kind,
    action: 'restricted.delete',
    resourceId: record.id,
    category: record.category,
    orgId: record.orgId,
    principalId: record.principalId,
    purpose: input.purpose,
    authorizationBasis: input.authorizationBasis,
    afterJson: record.fields,
    outcome: 'allow',
  })
  getState().records.delete(record.id)
  const tombstone: DeletionRecord = {
    recordId: record.id,
    primary: 'ACTIVE_DATA_DELETED',
    backups: 'HISTORICAL_BACKUP_AGING_OUT',
    backupPolicyMaxDays: BACKUP_POLICY_MAX_DAYS,
    backupPolicySource: 'governance/privacy/policies/data-retention-policy.md',
    bicepBackupRetentionDays: 35,
    bicepSource: 'infrastructure/bicep/modules/postgres.bicep',
    backupRuntimeVerified: false,
    deletedAt: now.toISOString(),
    backupEligibleAt: new Date(now.getTime() + BACKUP_POLICY_MAX_DAYS * 86_400_000).toISOString(),
    propagation: {
      replicas: 'PROPAGATION_REQUESTED',
      indexes: 'PROPAGATION_REQUESTED',
      caches: 'PROPAGATION_REQUESTED',
      derived: 'PROPAGATION_REQUESTED',
      logs: 'PROPAGATION_REQUESTED',
      exports: 'PROPAGATION_REQUESTED',
    },
    retainsFieldValues: false,
  }
  getState().tombstones.set(record.id, tombstone)
  return structuredClone(tombstone)
}

export function exportPrincipalRecords(input: {
  orgId: string
  principalId: string
  actor: Actor
  purpose: string
  authorizationBasis: string
  correlationId: string
}): {
  explicit: true
  orgId: string
  principalId: string
  classification: 'RESTRICTED'
  records: Array<{
    recordId: string
    category: string
    jurisdiction: string
    createdAt: string
    relationships: RestrictedRecordRelationships
    evidenceRefs: RestrictedRecordEvidence
    decisions: RestrictedRecordDecisions
    fields: Record<string, unknown>
  }>
} {
  const records = [...getState().records.values()].filter(
    (record) => record.orgId === input.orgId && record.principalId === input.principalId,
  )
  const exported = records.map((record) => {
    const read = readRestrictedRecord({
      action: 'export',
      orgId: input.orgId,
      principalId: input.principalId,
      recordId: record.id,
      actor: input.actor,
      purpose: input.purpose,
      authorizationBasis: input.authorizationBasis,
      serviceOrAgent: input.actor.kind === 'principal' ? 'principal' : input.actor.id,
      correlationId: input.correlationId,
    })
    return {
      recordId: record.id,
      category: record.category,
      jurisdiction: record.jurisdiction,
      createdAt: record.createdAt,
      relationships: structuredClone(record.relationships),
      evidenceRefs: structuredClone(record.evidenceRefs),
      decisions: structuredClone(record.decisions),
      fields: read.fields,
    }
  })
  recordRestrictedAudit({
    actorId: input.actor.id,
    serviceOrAgent: input.actor.kind === 'principal' ? 'principal' : input.actor.id,
    action: 'restricted.export',
    resourceId: input.principalId,
    category: 'restricted_export',
    orgId: input.orgId,
    principalId: input.principalId,
    purpose: input.purpose,
    authorizationBasis: input.authorizationBasis,
    correlationId: input.correlationId,
    outcome: 'allow',
  })
  getState().exportEvents.push(input.principalId)
  return {
    explicit: true,
    orgId: input.orgId,
    principalId: input.principalId,
    classification: 'RESTRICTED',
    records: exported,
  }
}

type RestrictedRecordRelationships = Array<{ type: string; targetId: string }>
type RestrictedRecordEvidence = Array<{ type: string; refId: string }>
type RestrictedRecordDecisions = Array<{ id: string; at: string; summary: string }>
