import { randomUUID } from 'node:crypto'
import { getState } from './state'
import { PlaneError, type BreakGlassActivation, type BreakGlassScope } from './types'

const MIN_REASON = 10
const MIN_MINUTES = 5
const MAX_MINUTES = 240

export function parseBreakGlassScope(scope: unknown): BreakGlassScope {
  if (typeof scope === 'string') {
    throw new PlaneError(
      'UNBOUNDED_SCOPE',
      'Break-glass scope must name appDomain, resource, and action. A platform-wide scope such as "full" is rejected.',
    )
  }
  if (!scope || typeof scope !== 'object') {
    throw new PlaneError('UNBOUNDED_SCOPE', 'Break-glass scope is required.')
  }
  const candidate = scope as Partial<BreakGlassScope> & { full?: unknown }
  if ('full' in candidate || (candidate as { scope?: unknown }).scope === 'full') {
    throw new PlaneError('UNBOUNDED_SCOPE', 'Platform-wide full scope is rejected.')
  }
  if (!candidate.appDomain || !candidate.resource || (candidate.action !== 'read' && candidate.action !== 'write')) {
    throw new PlaneError(
      'UNBOUNDED_SCOPE',
      'Break-glass scope must include appDomain, resource, and action read or write.',
    )
  }
  return {
    appDomain: candidate.appDomain,
    resource: candidate.resource,
    action: candidate.action,
    principalId: candidate.principalId,
  }
}

export function activateBreakGlass(input: {
  actorId: string
  reason: string
  durationMinutes: number
  scope: unknown
  now?: Date
}): BreakGlassActivation {
  if (!input.actorId) throw new PlaneError('BREAK_GLASS_ACTOR_REQUIRED', 'Break-glass actor is required.')
  if (input.reason.trim().length < MIN_REASON) {
    throw new PlaneError('BREAK_GLASS_REASON_REQUIRED', 'Break-glass reason must be at least 10 characters.')
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < MIN_MINUTES || input.durationMinutes > MAX_MINUTES) {
    throw new PlaneError('BREAK_GLASS_DURATION', 'Break-glass duration must be from 5 to 240 minutes.')
  }
  const scope = parseBreakGlassScope(input.scope)
  const now = input.now ?? new Date()
  const activation: BreakGlassActivation = {
    id: randomUUID(),
    actorId: input.actorId,
    reason: input.reason.trim(),
    scope,
    activatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.durationMinutes * 60_000).toISOString(),
    standingGrantCreated: false,
  }
  getState().breakGlass.push(activation)
  return activation
}

export function isBreakGlassActive(activation: BreakGlassActivation, now = new Date()): boolean {
  if (activation.revokedAt) return false
  return now.getTime() < Date.parse(activation.expiresAt)
}

export interface BreakGlassAccessRequest {
  activationId: string
  orgId: string
  principalId: string
  appDomain: string
  resource: string
  action: 'read' | 'write'
  now?: Date
}

export function evaluateBreakGlassAccess(request: BreakGlassAccessRequest): {
  allowed: boolean
  reason: string
  standingGrantCreated: false
  activation?: BreakGlassActivation
} {
  const activation = getState().breakGlass.find((item) => item.id === request.activationId)
  if (!activation) {
    return { allowed: false, reason: 'Break-glass activation was not found.', standingGrantCreated: false }
  }
  if (!isBreakGlassActive(activation, request.now ?? new Date())) {
    return { allowed: false, reason: 'Break-glass activation has expired or was revoked.', standingGrantCreated: false }
  }
  if (activation.scope.principalId && activation.scope.principalId !== request.principalId) {
    return { allowed: false, reason: 'Break-glass principal scope does not match.', standingGrantCreated: false }
  }
  if (activation.scope.appDomain !== request.appDomain || activation.scope.resource !== request.resource) {
    return { allowed: false, reason: 'Break-glass resource scope does not match.', standingGrantCreated: false }
  }
  if (activation.scope.action !== request.action) {
    return { allowed: false, reason: 'Break-glass action scope does not match.', standingGrantCreated: false }
  }
  if (getState().grants.size > 0 && [...getState().grants.values()].some((grant) => grant.id === activation.id)) {
    return { allowed: false, reason: 'Break-glass must not become a standing grant.', standingGrantCreated: false }
  }
  return { allowed: true, reason: 'Scoped break-glass window is active.', standingGrantCreated: false, activation }
}

export function revokeBreakGlass(activationId: string, now = new Date()): void {
  const activation = getState().breakGlass.find((item) => item.id === activationId)
  if (!activation) throw new PlaneError('BREAK_GLASS_NOT_FOUND', 'Break-glass activation was not found.')
  activation.revokedAt = now.toISOString()
}
