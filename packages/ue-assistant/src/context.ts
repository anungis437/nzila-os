/**
 * @nzila/ue-assistant — Context Resolution Engine (Phase 3)
 *
 * Resolves and validates per-request user context. Enforces org/local
 * isolation, role-based data filtering, and entitlement-aware access.
 */
import {
  userContextSchema,
  type UserContext,
  type UEAssistantRole,
  UEAssistantRoles,
} from './types'

// ── Context Validation ──────────────────────────────────────────────────────

export function resolveContext(raw: unknown): UserContext {
  const parsed = userContextSchema.parse(raw)
  return parsed as UserContext
}

/**
 * Ensure the context is org-scoped: orgId and localId must be present.
 */
export function validateOrgScope(ctx: UserContext): void {
  if (!ctx.orgId) {
    throw new Error('Context validation failed: orgId is required')
  }
  if (!ctx.localId) {
    throw new Error('Context validation failed: localId is required')
  }
}

/**
 * Strict org/local isolation — verifies that a data record belongs
 * to the same org and local as the requesting user.
 */
export function enforceIsolation(
  ctx: UserContext,
  dataOrgId: string,
  dataLocalId: string,
): boolean {
  if (ctx.orgId !== dataOrgId) return false
  // Parent admins can access any local within their org
  if (ctx.userRole === UEAssistantRoles.PARENT_ADMIN) return true
  return ctx.localId === dataLocalId
}

/**
 * Check if a module is active for the current context.
 */
export function isModuleActive(
  ctx: UserContext,
  moduleKey: string,
): boolean {
  return ctx.activeModules.includes(moduleKey)
}

/**
 * Check if the user has a specific entitlement.
 */
export function hasEntitlement(
  ctx: UserContext,
  entitlement: string,
): boolean {
  return ctx.entitlements.includes(entitlement)
}

/**
 * Filter data access based on role-specific rules.
 * Members can only access their own cases.
 * Stewards can access assigned cases.
 * Local admins can access all local cases.
 * Parent admins can access cross-local cases.
 */
export function filterCaseAccess(
  ctx: UserContext,
  caseOwnerId: string,
  assignedStewardId?: string,
  actorId?: string,
): boolean {
  switch (ctx.userRole) {
    case UEAssistantRoles.MEMBER:
      return actorId !== undefined && actorId === caseOwnerId
    case UEAssistantRoles.STEWARD:
      return (
        actorId !== undefined &&
        assignedStewardId !== undefined &&
        actorId === assignedStewardId
      )
    case UEAssistantRoles.LOCAL_ADMIN:
    case UEAssistantRoles.PARENT_ADMIN:
      return true
    default:
      return false
  }
}

/**
 * Build a minimal context for testing and internal use.
 */
export function buildContext(params: {
  orgId: string
  localId: string
  userRole: UEAssistantRole
  language?: string
  employer?: string
  entitlements?: readonly string[]
  activeModules?: readonly string[]
  openCases?: readonly string[]
  submissions?: readonly string[]
  participation?: readonly string[]
}): UserContext {
  return {
    orgId: params.orgId,
    localId: params.localId,
    userRole: params.userRole,
    language: params.language ?? 'en',
    employer: params.employer,
    entitlements: params.entitlements ?? [],
    activeModules: params.activeModules ?? [],
    userState: {
      openCases: params.openCases ?? [],
      submissions: params.submissions ?? [],
      participation: params.participation ?? [],
    },
  }
}
