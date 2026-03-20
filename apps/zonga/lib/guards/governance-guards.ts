/**
 * Zonga — Governance & Security Guards (G1–G5)
 *
 * Runtime enforcement of governance policies and security rules.
 *
 * G1: Admin actions require reason ≥ 10 characters
 * G2: Role-based action authorization
 * G3: Rate limiting (max operations per actor per window)
 * G4: Audit completeness (every mutation must have audit)
 * G5: Environment-specific restrictions
 */

import { logger } from '@/lib/logger'

export interface GovernanceGuardResult {
  passed: boolean
  invariant: string
  details?: string
}

/** G1: Admin actions must include a reason of sufficient length */
export function guardAdminActionReason(
  reason: string | undefined,
  minLength: number = 10,
): GovernanceGuardResult {
  if (!reason || reason.trim().length < minLength) {
    logger.warn('G1 VIOLATION: Admin action missing sufficient reason', {
      reasonLength: reason?.trim().length ?? 0,
      minLength,
    })
    return {
      passed: false,
      invariant: 'G1_ADMIN_REASON_REQUIRED',
      details: `Admin action reason must be at least ${minLength} characters (got ${reason?.trim().length ?? 0})`,
    }
  }
  return { passed: true, invariant: 'G1_ADMIN_REASON_REQUIRED' }
}

/** G2: Validate that an actor has the required role for the action */
export function guardRoleAuthorization(
  actorRole: string,
  requiredRoles: string[],
): GovernanceGuardResult {
  if (!requiredRoles.includes(actorRole)) {
    logger.warn('G2 VIOLATION: Actor lacks required role', {
      actorRole,
      requiredRoles,
    })
    return {
      passed: false,
      invariant: 'G2_ROLE_AUTHORIZATION',
      details: `Role '${actorRole}' not in allowed roles: ${requiredRoles.join(', ')}`,
    }
  }
  return { passed: true, invariant: 'G2_ROLE_AUTHORIZATION' }
}

/** G3: rate-limit check — caller passes current count for the window */
export function guardRateLimit(
  currentCount: number,
  maxAllowed: number,
  windowDescription: string = '1 hour',
): GovernanceGuardResult {
  if (currentCount >= maxAllowed) {
    logger.warn('G3 VIOLATION: Rate limit exceeded', {
      currentCount,
      maxAllowed,
      window: windowDescription,
    })
    return {
      passed: false,
      invariant: 'G3_RATE_LIMIT',
      details: `Rate limit exceeded: ${currentCount}/${maxAllowed} in ${windowDescription}`,
    }
  }
  return { passed: true, invariant: 'G3_RATE_LIMIT' }
}

/** G4: Verify that a mutation has a corresponding audit entry */
export function guardAuditCompleteness(
  hasAuditEntry: boolean,
  entityType: string,
  entityId: string,
): GovernanceGuardResult {
  if (!hasAuditEntry) {
    logger.error('G4 VIOLATION: Mutation without audit entry', {
      entityType,
      entityId,
    })
    return {
      passed: false,
      invariant: 'G4_AUDIT_COMPLETENESS',
      details: `No audit entry found for ${entityType}:${entityId}`,
    }
  }
  return { passed: true, invariant: 'G4_AUDIT_COMPLETENESS' }
}

/** G5: Block operations not allowed in the current environment */
export function guardEnvironmentRestriction(
  operation: string,
  environment: string,
  blockedIn: string[] = ['production'],
): GovernanceGuardResult {
  if (blockedIn.includes(environment)) {
    logger.warn('G5 VIOLATION: Operation blocked in environment', {
      operation,
      environment,
    })
    return {
      passed: false,
      invariant: 'G5_ENVIRONMENT_RESTRICTION',
      details: `Operation '${operation}' is blocked in ${environment} environment`,
    }
  }
  return { passed: true, invariant: 'G5_ENVIRONMENT_RESTRICTION' }
}
