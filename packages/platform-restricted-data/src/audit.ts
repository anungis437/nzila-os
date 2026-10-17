import { randomUUID } from 'node:crypto'
import { scrubSensitiveString } from './observability'
import { getState } from './state'
import { PlaneError, type RestrictedAuditEvent } from './types'

export interface RestrictedAuditInput {
  actorId: string
  serviceOrAgent: string
  action: string
  resourceId: string
  category: string
  orgId: string
  principalId: string
  purpose: string
  authorizationBasis: string
  correlationId?: string
  missionId?: string
  breakGlassReason?: string
  outcome: 'allow' | 'deny'
  /** Raw snapshots. They are dropped. Their string values must not reappear. */
  beforeJson?: unknown
  afterJson?: unknown
  at?: string
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.length >= 8) out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectStrings(entry, out)
  }
}

export function buildRestrictedAuditEvent(input: RestrictedAuditInput): RestrictedAuditEvent {
  if (!input.purpose.trim() || !input.category.trim() || !input.authorizationBasis.trim()) {
    throw new PlaneError(
      'RESTRICTED_AUDIT_METADATA_REQUIRED',
      'Restricted audit requires purpose, data category, and authorization basis.',
    )
  }
  if (!input.actorId || !input.orgId || !input.serviceOrAgent || !input.action || !input.resourceId || !input.principalId) {
    throw new PlaneError(
      'RESTRICTED_AUDIT_METADATA_REQUIRED',
      'Restricted audit requires actor, service or agent, action, resource id, and principal scope.',
    )
  }

  const forbidden: string[] = []
  collectStrings(input.beforeJson, forbidden)
  collectStrings(input.afterJson, forbidden)

  const event: RestrictedAuditEvent = {
    id: randomUUID(),
    at: input.at ?? new Date().toISOString(),
    actorId: input.actorId,
    serviceOrAgent: input.serviceOrAgent,
    action: input.action,
    resourceId: input.resourceId,
    category: input.category,
    orgId: input.orgId,
    principalId: input.principalId,
    purpose: scrubSensitiveString(input.purpose),
    authorizationBasis: scrubSensitiveString(input.authorizationBasis),
    correlationId: input.correlationId,
    missionId: input.missionId,
    breakGlassReason: input.breakGlassReason ? scrubSensitiveString(input.breakGlassReason) : undefined,
    outcome: input.outcome,
    payloadStored: false,
  }

  const serialized = JSON.stringify(event)
  for (const secret of forbidden) {
    if (serialized.includes(secret)) {
      throw new PlaneError(
        'RESTRICTED_VALUE_IN_AUDIT',
        'Restricted audit metadata repeated a raw payload value.',
      )
    }
  }
  return event
}

export function recordRestrictedAudit(input: RestrictedAuditInput): RestrictedAuditEvent {
  const event = buildRestrictedAuditEvent(input)
  getState().audit.push(event)
  return structuredClone(event)
}
