// ─── Human Override Model ────────────────────────────────────────
// Allows chief_steward+ to override WIL-generated priorities
// with full audit trail and reason tracking.

import { randomUUID } from 'node:crypto'
import type { PriorityLevel } from '../models/types.js'
import type { AuthorityRole } from '../authority/permissions.js'
import { canOverridePriority } from '../authority/permissions.js'

export interface PriorityOverride {
  readonly overrideId: string
  readonly workItemId: string
  readonly orgId: string
  readonly overriddenBy: string
  readonly overriddenByRole: AuthorityRole
  readonly previousLevel: PriorityLevel
  readonly newLevel: PriorityLevel
  readonly previousScore: number
  readonly reason: string
  readonly overriddenAt: string
  readonly operation: 'override' | 'pin' | 'defer'
}

export interface OverrideManager {
  applyOverride(params: {
    workItemId: string
    orgId: string
    actorId: string
    actorRole: AuthorityRole
    previousLevel: PriorityLevel
    previousScore: number
    newLevel: PriorityLevel
    reason: string
  }): PriorityOverride | { error: string }

  pinItem(params: {
    workItemId: string
    orgId: string
    actorId: string
    actorRole: AuthorityRole
    currentLevel: PriorityLevel
    currentScore: number
    reason: string
  }): PriorityOverride | { error: string }

  deferItem(params: {
    workItemId: string
    orgId: string
    actorId: string
    actorRole: AuthorityRole
    currentLevel: PriorityLevel
    currentScore: number
    reason: string
  }): PriorityOverride | { error: string }
}

/**
 * Create an override manager for human priority adjustments.
 */
export function createOverrideManager(): OverrideManager {
  function validateAuthority(actorRole: AuthorityRole): string | null {
    if (!canOverridePriority(actorRole)) {
      return `Role '${actorRole}' lacks authority to override priorities (requires chief_steward+)`
    }
    return null
  }

  function validateReason(reason: string): string | null {
    if (!reason || reason.trim().length < 10) {
      return 'Override reason must be at least 10 characters'
    }
    return null
  }

  return {
    applyOverride(params) {
      const authError = validateAuthority(params.actorRole)
      if (authError) return { error: authError }

      const reasonError = validateReason(params.reason)
      if (reasonError) return { error: reasonError }

      if (params.previousLevel === params.newLevel) {
        return {
          error: 'New priority level must differ from current level',
        }
      }

      return {
        overrideId: randomUUID(),
        workItemId: params.workItemId,
        orgId: params.orgId,
        overriddenBy: params.actorId,
        overriddenByRole: params.actorRole,
        previousLevel: params.previousLevel,
        newLevel: params.newLevel,
        previousScore: params.previousScore,
        reason: params.reason.trim(),
        overriddenAt: new Date().toISOString(),
        operation: 'override',
      }
    },

    pinItem(params) {
      const authError = validateAuthority(params.actorRole)
      if (authError) return { error: authError }

      const reasonError = validateReason(params.reason)
      if (reasonError) return { error: reasonError }

      return {
        overrideId: randomUUID(),
        workItemId: params.workItemId,
        orgId: params.orgId,
        overriddenBy: params.actorId,
        overriddenByRole: params.actorRole,
        previousLevel: params.currentLevel,
        newLevel: params.currentLevel,
        previousScore: params.currentScore,
        reason: params.reason.trim(),
        overriddenAt: new Date().toISOString(),
        operation: 'pin',
      }
    },

    deferItem(params) {
      const authError = validateAuthority(params.actorRole)
      if (authError) return { error: authError }

      const reasonError = validateReason(params.reason)
      if (reasonError) return { error: reasonError }

      return {
        overrideId: randomUUID(),
        workItemId: params.workItemId,
        orgId: params.orgId,
        overriddenBy: params.actorId,
        overriddenByRole: params.actorRole,
        previousLevel: params.currentLevel,
        newLevel: 'low',
        previousScore: params.currentScore,
        reason: params.reason.trim(),
        overriddenAt: new Date().toISOString(),
        operation: 'defer',
      }
    },
  }
}
