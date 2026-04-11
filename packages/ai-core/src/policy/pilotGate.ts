/**
 * @nzila/ai-core — Pilot-Mode Gate for AI Actions
 *
 * Evaluates pilot flags for AI action types, enabling gradual rollout
 * of AI capabilities per-org and per-user instead of binary on/off.
 *
 * If a flag `ai.{actionType}` exists and evaluates to disabled,
 * the action is gated. If no flag exists, the action is allowed
 * (open by default — kill-switch handles emergency disabling).
 *
 * @module policy/pilotGate
 */

import { evaluatePilotFlag, type PilotFlagDef, type PilotContext } from '@nzila/pilot-mode'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PilotGateResult {
  readonly gated: boolean
  readonly reason: string | null
  readonly flagName: string
}

// ── Flag registry (in-memory, populated at startup or via admin API) ────────

const pilotFlags = new Map<string, PilotFlagDef>()

/**
 * Register a pilot flag for an AI action type.
 * Call during app bootstrap or from the admin API.
 */
export function registerAiPilotFlag(actionType: string, flag: PilotFlagDef): void {
  pilotFlags.set(actionType, flag)
}

/**
 * Remove a pilot flag registration.
 */
export function unregisterAiPilotFlag(actionType: string): void {
  pilotFlags.delete(actionType)
}

/**
 * Get all registered pilot flags (for dashboard).
 */
export function getRegisteredAiPilotFlags(): ReadonlyMap<string, PilotFlagDef> {
  return pilotFlags
}

// ── Gate check ──────────────────────────────────────────────────────────────

/**
 * Check whether an AI action is gated by a pilot flag.
 *
 * Returns `gated: false` if no pilot flag is registered for the action
 * (open by default). Returns `gated: true` only when a flag exists
 * AND evaluates to disabled for the given org/user context.
 */
export function checkPilotGate(
  actionType: string,
  ctx: PilotContext,
): PilotGateResult {
  const flagName = `ai.${actionType}`
  const flag = pilotFlags.get(actionType)

  // No flag registered → action is open (not gated)
  if (!flag) {
    return { gated: false, reason: null, flagName }
  }

  const evaluation = evaluatePilotFlag(flag, ctx)

  if (!evaluation.enabled) {
    return {
      gated: true,
      reason: `Pilot flag '${flagName}' disabled for org=${ctx.orgId}: ${evaluation.reason}`,
      flagName,
    }
  }

  return { gated: false, reason: null, flagName }
}
