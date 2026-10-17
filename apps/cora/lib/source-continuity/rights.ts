import { rightsSnapshotSchema, type RightState, type RightsSnapshot } from './contracts'

export type RightsAction =
  | 'CAPTURE'
  | 'IDENTITY_RESOLUTION'
  | 'TRANSFORM'
  | 'PERSIST'
  | 'DISCLOSE'
  | 'EXPORT'
  | 'REHYDRATE'
  | 'REVOKE'
  | 'DELETE'

export interface RightsEvaluationContext {
  purpose: string
  recipientId: string
  at: string
  actorId?: string
}

export interface RightsDecision {
  allowed: boolean
  reasons: string[]
}

type ActionRight =
  | 'sourceAccess'
  | 'transientProcessing'
  | 'persistence'
  | 'transformation'
  | 'disclosure'
  | 'export'
  | 'rehydration'
  | 'deletion'
  | 'retentionAfterDisconnect'

const actionRights: Record<RightsAction, ActionRight[]> = {
  CAPTURE: ['sourceAccess', 'transientProcessing'],
  IDENTITY_RESOLUTION: ['transientProcessing'],
  TRANSFORM: ['transientProcessing', 'transformation'],
  PERSIST: ['persistence', 'retentionAfterDisconnect'],
  DISCLOSE: ['disclosure'],
  EXPORT: ['export', 'disclosure'],
  REHYDRATE: ['rehydration', 'transientProcessing'],
  REVOKE: [],
  DELETE: ['deletion'],
}

export function evaluateRights(
  input: RightsSnapshot,
  action: RightsAction,
  context: RightsEvaluationContext,
): RightsDecision {
  const rights = rightsSnapshotSchema.parse(input)
  const at = Date.parse(context.at)
  const reasons: string[] = []

  if (!Number.isFinite(at)) reasons.push('INVALID_EVALUATION_TIME')
  if (
    action !== 'DELETE' &&
    action !== 'REVOKE' &&
    rights.revokedAt &&
    Date.parse(rights.revokedAt) <= at
  ) {
    reasons.push('RIGHTS_REVOKED')
  }
  if (
    action !== 'DELETE' &&
    action !== 'REVOKE' &&
    rights.validFrom &&
    Date.parse(rights.validFrom) > at
  ) {
    reasons.push('RIGHTS_NOT_YET_VALID')
  }
  if (
    action !== 'DELETE' &&
    action !== 'REVOKE' &&
    rights.expiresAt &&
    Date.parse(rights.expiresAt) <= at
  ) {
    reasons.push('RIGHTS_EXPIRED')
  }
  if (
    action !== 'DELETE' &&
    action !== 'REVOKE' &&
    !rights.permittedPurposes.includes(context.purpose)
  ) {
    reasons.push('PURPOSE_NOT_AUTHORIZED')
  }
  if (
    action !== 'DELETE' &&
    action !== 'REVOKE' &&
    !rights.permittedRecipients.includes(context.recipientId)
  ) {
    reasons.push('RECIPIENT_NOT_AUTHORIZED')
  }
  if (action === 'REVOKE') {
    if (!context.actorId) {
      reasons.push('REVOCATION_ACTOR_NOT_PROVIDED')
    } else if (!rights.revocationAuthorityIds.includes(context.actorId)) {
      reasons.push('REVOCATION_ACTOR_NOT_AUTHORIZED')
    }
  }

  for (const key of actionRights[action]) {
    const state: RightState = rights[key]
    if (state === 'ALLOWED') continue
    reasons.push(
      state === 'ALLOWED_WITH_CONDITIONS'
        ? `${key.toUpperCase()}_CONDITIONS_NOT_VERIFIED`
        : `${key.toUpperCase()}_${state}`,
    )
  }

  return { allowed: reasons.length === 0, reasons }
}
