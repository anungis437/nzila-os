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
  if (input.explicitTier !== 'RESTRICTED' || [input.appId, input.orgId, input.principalId, input.category, input.jurisdiction].some((value) => typeof value !== 'string' || !value.trim())) {
    throw new PlaneError('RESTRICTED_SCOPE_REQUIRED', 'Restricted storage requires an explicit Restricted tier and complete app, org, principal and category scope.')
  }
  classifyRecord({
    appId: input.appId,
    explicitTier: input.explicitTier,
    sensitiveSchema: true,
    fields: input.fields,
  })
  rejectSecretIngestion(JSON.stringify(input.fields))
  const record: RestrictedRecord = {
    id: randomUUID(),
    appId: input.appId,
    orgId: input.orgId,
    principalId: input.principalId,
    classification: 'RESTRICTED',
    category: input.category,
    fields: structuredClone(input.fields),
    relationships: structuredClone(input.relationships ?? []),
    evidenceRefs: structuredClone(input.evidenceRefs ?? []),
    jurisdiction: input.jurisdiction,
    decisions: structuredClone(input.decisions ?? []),
    createdAt: new Date().toISOString(),
  }
  getState().records.set(record.id, record)
  return structuredClone(record)
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
  if (input.actorId === input.grantedBy) {
    throw new PlaneError('FLEET_SELF_GRANT', 'A service or agent cannot issue itself a Restricted access grant.')
  }
  if (
    !input.orgId?.trim() || !input.principalId?.trim() || !input.actorId?.trim() || !input.grantedBy?.trim() ||
    !['service', 'agent'].includes(input.actorKind) ||
    !Array.isArray(input.actions) || input.actions.length === 0 || input.actions.some((action) => !['read', 'export'].includes(action)) ||
    (input.disclosureProfile !== undefined && input.disclosureProfile !== 'VERIFIER') ||
    (input.expiresAt !== undefined && !Number.isFinite(Date.parse(input.expiresAt)))
  ) throw new PlaneError('INVALID_RESTRICTED_GRANT', 'Restricted grants require explicit valid identity, actions, disclosure and expiry fields.')
  const grant: AccessGrant = {
    id: randomUUID(),
    orgId: input.orgId,
    principalId: input.principalId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    actions: [...input.actions],
    purpose: input.purpose,
    authorizationBasis: input.authorizationBasis,
    disclosureProfile: input.disclosureProfile,
    expiresAt: input.expiresAt,
    grantedBy: input.grantedBy,
    createdAt: new Date().toISOString(),
  }
  getState().grants.set(grant.id, grant)
  return structuredClone(grant)
}

export interface ReadRequest {
  action?: 'read' | 'export'
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
  const action = request.action ?? 'read'
  if (!['read', 'export'].includes(action) || (request.disclosureProfile !== undefined && request.disclosureProfile !== 'VERIFIER'))
    throw new PlaneError('INVALID_RESTRICTED_REQUEST', 'Unknown Restricted action or disclosure profile.')
  const time = Date.now()
  if (!Number.isFinite(time)) throw new PlaneError('INVALID_ACCESS_TIME', 'Restricted access requires a valid time.')
  const record = getState().records.get(request.recordId)
  const baseAudit = {
    actorId: request.actor.id,
    serviceOrAgent: request.serviceOrAgent,
    action: `restricted.${action}`,
    resourceId: request.recordId,
    category: record?.orgId === request.orgId && record.principalId === request.principalId ? record.category : 'unknown',
    orgId: request.orgId,
    principalId: request.principalId,
    purpose: request.purpose,
    authorizationBasis: request.authorizationBasis,
    correlationId: request.correlationId,
    missionId: request.missionId,
  }

  const deny = (code: string, message: string): never => {
    // Denial metadata cannot be used to inject arbitrary Restricted prose into
    // the audit store. These labels describe a denial, never an authorization.
    recordRestrictedAudit({ ...baseAudit, purpose: 'ACCESS_DENIED', authorizationBasis: 'NO_VALID_AUTHORIZATION', outcome: 'deny' })
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
    if (request.actor.kind !== 'principal' || action !== 'read') deny('BREAK_GLASS_DENIED', 'Break-glass is a human read scope, not an agent or export grant.')
    if ((request.resource && request.resource !== record.id) || (request.appDomain && request.appDomain !== record.appId))
      deny('BREAK_GLASS_DENIED', 'Request hints cannot replace the actual record resource or application.')
    const emergency = evaluateBreakGlassAccess({
      activationId: request.breakGlassId,
      actorId: request.actor.id,
      orgId: request.orgId,
      principalId: request.principalId,
      appDomain: record.appId,
      resource: record.id,
      action: 'read',
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
      if (!item.actions.includes(action)) return false
      if (item.purpose !== request.purpose || item.authorizationBasis !== request.authorizationBasis) return false
      if (item.expiresAt && (!Number.isFinite(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) <= time)) return false
      return true
    })
    if (!grant) {
      deny('AGENT_DENIED', 'Service and agent Restricted access requires an explicit grant. Fleet membership is not a grant.')
    }
    if (!grant) {
      throw new PlaneError('AGENT_DENIED', 'Service and agent Restricted access requires an explicit grant. Fleet membership is not a grant.')
    }
    if (request.actor.actingForPrincipalId !== record.principalId) {
      deny('CROSS_PRINCIPAL_DENIED', 'An actor for one principal cannot read another principal record.')
    }
    profile = grant.disclosureProfile ?? request.disclosureProfile
  }

  if (profile === 'VERIFIER') {
    if (action === 'export') deny('VERIFIER_EXPORT_DENIED', 'VERIFIER minimum disclosure does not permit a principal export bundle.')
    const requested = request.requestedFields ?? [...VERIFIER_FIELDS]
    const extra = requested.filter((field) => !VERIFIER_FIELDS.includes(field as (typeof VERIFIER_FIELDS)[number]))
    if (extra.length > 0) {
      deny('OVER_BROAD_DISCLOSURE', 'VERIFIER disclosure refuses fields outside minimum necessary.')
    }
    recordRestrictedAudit({ ...baseAudit, afterJson: record.fields, outcome: 'allow', breakGlassReason })
    return {
      allowed: true,
      fields: structuredClone(project(record, VERIFIER_FIELDS)),
      recordId: record.id,
      classification: 'RESTRICTED',
      principalId: record.principalId,
    }
  }

  recordRestrictedAudit({ ...baseAudit, afterJson: record.fields, outcome: 'allow', breakGlassReason })
  return {
    allowed: true,
    fields: structuredClone(record.fields),
    recordId: record.id,
    classification: 'RESTRICTED',
    principalId: record.principalId,
  }
}
