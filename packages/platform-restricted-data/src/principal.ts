import { randomUUID } from 'node:crypto'
import { recordRestrictedAudit } from './audit'
import { evaluateBreakGlassAccess } from './break-glass'
import { classifyRecord } from './classification'
import { rejectSecretIngestion } from './secrets'
import { getState } from './state'
import { PlaneError, type AccessGrant, type Actor, type RestrictedRecord } from './types'

export const FLEET_AGENTS = ['SCOUT', 'VERIFIER', 'REDTEAM', 'BUILDER', 'FORGE', 'COUNSEL'] as const

export const VERIFIER_FIELDS = ['proposition', 'authorityRefs', 'predicates'] as const

/** Fleet membership never implies Restricted access. */
export function fleetMemberHasImplicitRestrictedAccess(_agentName: string): false {
  return false
}

export function putRestrictedRecord(input: {
  appId: string
  orgId: string
  principalId: string
  category: string
  fields: Record<string, unknown>
  relationships?: RestrictedRecord['relationships']
  evidenceRefs?: RestrictedRecord['evidenceRefs']
  jurisdiction: string
  decisions?: RestrictedRecord['decisions']
  explicitTier: 'RESTRICTED'
}): RestrictedRecord {
  classifyRecord({
    appId: input.appId,
    explicitTier: input.explicitTier,
    sensitiveSchema: true,
    fields: input.fields,
  })
  rejectSecretIngestion(JSON.stringify(input.fields))
  const record: RestrictedRecord = {
    id: randomUUID(),
    orgId: input.orgId,
    principalId: input.principalId,
    classification: 'RESTRICTED',
    category: input.category,
    fields: input.fields,
    relationships: input.relationships ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    jurisdiction: input.jurisdiction,
    decisions: input.decisions ?? [],
    createdAt: new Date().toISOString(),
  }
  getState().records.set(record.id, record)
  return record
}

export function grantRestrictedAccess(input: {
  orgId: string
  principalId: string
  actorKind: 'service' | 'agent'
  actorId: string
  actions: Array<'read' | 'export'>
  purpose: string
  authorizationBasis: string
  disclosureProfile?: 'VERIFIER'
  expiresAt?: string
  grantedBy: string
}): AccessGrant {
  if (!input.purpose.trim() || !input.authorizationBasis.trim()) {
    throw new PlaneError('GRANT_BASIS_REQUIRED', 'A Restricted grant requires purpose and authorization basis.')
  }
  if (FLEET_AGENTS.includes(input.actorId as (typeof FLEET_AGENTS)[number]) && input.actorId === input.grantedBy) {
    throw new PlaneError('FLEET_SELF_GRANT', 'An agent cannot grant itself Restricted access by fleet membership.')
  }
  const grant: AccessGrant = {
    id: randomUUID(),
    orgId: input.orgId,
    principalId: input.principalId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    actions: input.actions,
    purpose: input.purpose,
    authorizationBasis: input.authorizationBasis,
    disclosureProfile: input.disclosureProfile,
    expiresAt: input.expiresAt,
    grantedBy: input.grantedBy,
    createdAt: new Date().toISOString(),
  }
  getState().grants.set(grant.id, grant)
  return grant
}

export interface ReadRequest {
  orgId: string
  principalId: string
  recordId: string
  actor: Actor
  purpose: string
  authorizationBasis: string
  serviceOrAgent: string
  requestedFields?: string[]
  disclosureProfile?: 'VERIFIER'
  correlationId?: string
  missionId?: string
  breakGlassId?: string
  appDomain?: string
  resource?: string
  now?: Date
}

function project(record: RestrictedRecord, fields: readonly string[]): Record<string, unknown> {
  const projected: Record<string, unknown> = {}
  for (const field of fields) {
    if (field in record.fields) projected[field] = record.fields[field]
  }
  return projected
}

export function readRestrictedRecord(request: ReadRequest): {
  allowed: true
  fields: Record<string, unknown>
  recordId: string
  classification: 'RESTRICTED'
  principalId: string
} {
  const record = getState().records.get(request.recordId)
  const baseAudit = {
    actorId: request.actor.id,
    serviceOrAgent: request.serviceOrAgent,
    action: 'restricted.read',
    resourceId: request.recordId,
    category: record?.category ?? 'unknown',
    orgId: request.orgId,
    principalId: request.principalId,
    purpose: request.purpose,
    authorizationBasis: request.authorizationBasis,
    correlationId: request.correlationId,
    missionId: request.missionId,
  }

  const deny = (code: string, message: string): never => {
    if (request.purpose.trim() && request.authorizationBasis.trim()) {
      recordRestrictedAudit({ ...baseAudit, outcome: 'deny' })
    }
    throw new PlaneError(code, message)
  }

  if (getState().tombstones.has(request.recordId)) {
    deny('ACTIVE_DATA_DELETED', 'Active Restricted data for this record has been deleted.')
  }
  if (!record || record.orgId !== request.orgId || record.principalId !== request.principalId) {
    deny('NOT_FOUND', 'Restricted record is not visible in this principal scope.')
  }
  if (!record) {
    throw new PlaneError('NOT_FOUND', 'Restricted record is not visible in this principal scope.')
  }

  let breakGlassReason: string | undefined
  let profile = request.disclosureProfile
  if (request.breakGlassId) {
    const emergency = evaluateBreakGlassAccess({
      activationId: request.breakGlassId,
      orgId: request.orgId,
      principalId: request.principalId,
      appDomain: request.appDomain ?? '',
      resource: request.resource ?? record.id,
      action: 'read',
      now: request.now,
    })
    if (!emergency.allowed || !emergency.activation) deny('BREAK_GLASS_DENIED', emergency.reason)
    if (!emergency.activation) {
      throw new PlaneError('BREAK_GLASS_DENIED', emergency.reason)
    }
    if (emergency.standingGrantCreated) deny('STANDING_GRANT_FORBIDDEN', 'Break-glass created a standing grant.')
    breakGlassReason = emergency.activation.reason
  } else if (request.actor.kind === 'principal') {
    if (request.actor.id !== record.principalId) {
      deny('CROSS_PRINCIPAL_DENIED', 'A principal cannot read another principal Restricted record in the same org.')
    }
  } else {
    const grant = [...getState().grants.values()].find((item) => {
      if (item.orgId !== request.orgId || item.principalId !== record.principalId) return false
      if (item.actorKind !== request.actor.kind || item.actorId !== request.actor.id) return false
      if (!item.actions.includes('read')) return false
      if (item.expiresAt && Date.parse(item.expiresAt) <= (request.now ?? new Date()).getTime()) return false
      return true
    })
    if (!grant) {
      deny('AGENT_DENIED', 'Service and agent Restricted access requires an explicit grant. Fleet membership is not a grant.')
    }
    if (!grant) {
      throw new PlaneError('AGENT_DENIED', 'Service and agent Restricted access requires an explicit grant. Fleet membership is not a grant.')
    }
    if (request.actor.actingForPrincipalId && request.actor.actingForPrincipalId !== record.principalId) {
      deny('CROSS_PRINCIPAL_DENIED', 'An actor for one principal cannot read another principal record.')
    }
    profile = request.disclosureProfile ?? grant.disclosureProfile
  }

  if (profile === 'VERIFIER') {
    const requested = request.requestedFields ?? [...VERIFIER_FIELDS]
    const extra = requested.filter((field) => !VERIFIER_FIELDS.includes(field as (typeof VERIFIER_FIELDS)[number]))
    if (extra.length > 0) {
      deny('OVER_BROAD_DISCLOSURE', `VERIFIER disclosure refuses fields outside minimum necessary: ${extra.join(', ')}.`)
    }
    recordRestrictedAudit({ ...baseAudit, outcome: 'allow', breakGlassReason })
    return {
      allowed: true,
      fields: project(record, VERIFIER_FIELDS),
      recordId: record.id,
      classification: 'RESTRICTED',
      principalId: record.principalId,
    }
  }

  recordRestrictedAudit({ ...baseAudit, outcome: 'allow', breakGlassReason })
  return {
    allowed: true,
    fields: { ...record.fields },
    recordId: record.id,
    classification: 'RESTRICTED',
    principalId: record.principalId,
  }
}
