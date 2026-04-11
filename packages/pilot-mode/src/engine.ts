/**
 * @nzila/pilot-mode — Engine
 *
 * Pure-logic pilot flag evaluation. No I/O, no DB.
 * Deterministic hash-based percentage rollout.
 *
 * @module @nzila/pilot-mode/engine
 */
import type {
  PilotFlagDef,
  PilotContext,
  PilotEvaluation,
  PilotEvaluationReason,
  PilotCohort,
} from './types'

// ── Deterministic Hash Rollout ──────────────────────────────────────────────

/**
 * Simple deterministic hash for percentage-based rollout.
 * Returns a number 0–99 based on flagName + entityId.
 *
 * Uses djb2 hash — fast, deterministic, no crypto needed.
 * Same flag + entity always produces the same bucket.
 */
export function hashBucket(flagName: string, entityId: string): number {
  const input = `${flagName}:${entityId}`
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 100
}

// ── Single Flag Evaluation ──────────────────────────────────────────────────

/**
 * Evaluate a single pilot flag against a context.
 *
 * Evaluation order:
 *   1. Disabled → false
 *   2. Expired → false
 *   3. Org targeted → true
 *   4. User targeted → true
 *   5. Cohort targeted → true
 *   6. Percentage rollout → deterministic hash
 *   7. No match → false
 */
export function evaluatePilotFlag(
  flag: PilotFlagDef,
  context: PilotContext,
  cohorts?: ReadonlyMap<string, PilotCohort>,
  now?: Date,
): PilotEvaluation {
  const timestamp = now ?? new Date()

  // 1. Master switch
  if (!flag.enabled) {
    return result(flag.name, false, 'flag_disabled')
  }

  // 2. Expiry check
  if (flag.expiresAt && new Date(flag.expiresAt) < timestamp) {
    return result(flag.name, false, 'flag_expired')
  }

  // 3. Org targeting
  if (flag.orgIds?.includes(context.orgId)) {
    return result(flag.name, true, 'org_targeted')
  }

  // 4. User targeting
  if (flag.userIds?.includes(context.userId)) {
    return result(flag.name, true, 'user_targeted')
  }

  // 5. Cohort targeting
  if (flag.cohortId && cohorts) {
    const cohort = cohorts.get(flag.cohortId)
    if (cohort?.orgIds.includes(context.orgId)) {
      return result(flag.name, true, 'cohort_targeted')
    }
  }

  // 6. Percentage rollout (hash on orgId for org-level consistency)
  if (flag.percentage != null && flag.percentage > 0) {
    const bucket = hashBucket(flag.name, context.orgId)
    if (bucket < flag.percentage) {
      return result(flag.name, true, 'percentage_included')
    }
    return result(flag.name, false, 'percentage_excluded')
  }

  // 7. No match
  return result(flag.name, false, 'no_match')
}

// ── Batch Evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate all flags against a context.
 * Returns a map of flagName → evaluation.
 */
export function evaluateAllFlags(
  flags: readonly PilotFlagDef[],
  context: PilotContext,
  cohorts?: ReadonlyMap<string, PilotCohort>,
  now?: Date,
): ReadonlyMap<string, PilotEvaluation> {
  const results = new Map<string, PilotEvaluation>()
  for (const flag of flags) {
    results.set(flag.name, evaluatePilotFlag(flag, context, cohorts, now))
  }
  return results
}

/**
 * Get only the enabled flags for a context.
 */
export function getEnabledPilotFlags(
  flags: readonly PilotFlagDef[],
  context: PilotContext,
  cohorts?: ReadonlyMap<string, PilotCohort>,
  now?: Date,
): readonly PilotFlagDef[] {
  return flags.filter((f) => {
    const evaluation = evaluatePilotFlag(f, context, cohorts, now)
    return evaluation.enabled
  })
}

// ── Flag Validation ─────────────────────────────────────────────────────────

/**
 * Validate a pilot flag definition for structural correctness.
 */
export function validatePilotFlag(flag: PilotFlagDef): readonly string[] {
  const errors: string[] = []

  if (!flag.name) errors.push('Flag must have a name')
  if (flag.percentage != null && (flag.percentage < 0 || flag.percentage > 100)) {
    errors.push('Percentage must be between 0 and 100')
  }
  if (flag.expiresAt && flag.activatedAt) {
    if (new Date(flag.expiresAt) <= new Date(flag.activatedAt)) {
      errors.push('expiresAt must be after activatedAt')
    }
  }

  return errors
}

// ── Internal Helper ─────────────────────────────────────────────────────────

function result(
  flag: string,
  enabled: boolean,
  reason: PilotEvaluationReason,
): PilotEvaluation {
  return { flag, enabled, reason }
}
