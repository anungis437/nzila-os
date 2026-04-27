import { ConsentRole, ConsentScope } from './types.js'
import type { AccessDecisionInput, AccessDecision } from './types.js'

export const ROLE_SCOPE_MAP: Record<ConsentRole, ConsentScope[]> = {
  [ConsentRole.CLINICIAN]: [
    ConsentScope.READ_TIMELINE,
    ConsentScope.READ_LABS,
    ConsentScope.READ_MEDICATIONS,
    ConsentScope.READ_REFERRALS,
  ],
  [ConsentRole.SPECIALIST]: [
    ConsentScope.READ_TIMELINE,
    ConsentScope.READ_LABS,
    ConsentScope.READ_REFERRALS,
  ],
  [ConsentRole.NURSE]: [
    ConsentScope.READ_TIMELINE,
    ConsentScope.READ_LABS,
    ConsentScope.READ_MEDICATIONS,
  ],
  [ConsentRole.ADMIN]: [ConsentScope.FULL_ACCESS],
  [ConsentRole.PRIVACY_OFFICER]: [ConsentScope.READ_TIMELINE],
  [ConsentRole.AUDITOR]: [ConsentScope.READ_TIMELINE],
}

export function decideAccess(input: AccessDecisionInput): AccessDecision {
  if (input.requestedScope === ConsentScope.BREAK_GLASS) {
    return {
      allowed: true,
      reason: input.reason ?? 'Break glass access invoked',
      requiresBreakGlass: true,
    }
  }

  const allowedScopes = ROLE_SCOPE_MAP[input.role] ?? []
  const hasAccess =
    allowedScopes.includes(ConsentScope.FULL_ACCESS) ||
    allowedScopes.includes(input.requestedScope)

  if (hasAccess) {
    return {
      allowed: true,
      reason: `Role ${input.role} is authorized for scope ${input.requestedScope}`,
      requiresBreakGlass: false,
    }
  }

  return {
    allowed: false,
    reason: `Role ${input.role} is not authorized for scope ${input.requestedScope}`,
    requiresBreakGlass: false,
  }
}
