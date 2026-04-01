/**
 * @nzila/ai-core — AI Action Kill-Switch
 * iSSDLC W1-8: Emergency kill-switch for AI actions in production
 *
 * Feature-flag-based circuit breaker that can disable any AI action type
 * or all AI actions globally without a code deploy.
 *
 * Controls:
 *  - Global kill-switch: AI_KILL_SWITCH=true disables ALL AI actions
 *  - Per-action kill: AI_KILL_{ACTION_TYPE}=true disables specific actions
 *  - Runtime DB check: ai_kill_switch_overrides table for hot-toggle
 *
 * @module policy/killSwitch
 */

import { appendAiAuditEvent, emitAiMetric } from '../logging'

// ── Types ────────────────────────────────────────────────────────────────────

export interface KillSwitchStatus {
  globalKilled: boolean
  actionKilled: boolean
  reason: string | null
  source: 'env' | 'db' | null
}

// ── In-memory cache for DB overrides (TTL 30s) ──────────────────────────────

interface CachedOverride {
  killed: boolean
  reason: string
  expiresAt: number
}

const overrideCache = new Map<string, CachedOverride>()
const CACHE_TTL_MS = 30_000

// ── Check kill-switch ────────────────────────────────────────────────────────

/**
 * Check whether an AI action type is killed (disabled).
 *
 * Priority: env global → env per-action → DB override
 *
 * Usage in gateway/actionsPolicy:
 *   const ks = checkKillSwitch(actionType)
 *   if (ks.globalKilled || ks.actionKilled) return blocked(ks.reason)
 */
export function checkKillSwitch(actionType: string): KillSwitchStatus {
  // 1. Global kill-switch (env var)
  if (process.env.AI_KILL_SWITCH === 'true') {
    return {
      globalKilled: true,
      actionKilled: false,
      reason: 'Global AI kill-switch is active (AI_KILL_SWITCH=true)',
      source: 'env',
    }
  }

  // 2. Per-action kill-switch (env var)
  const envKey = `AI_KILL_${actionType.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  if (process.env[envKey] === 'true') {
    return {
      globalKilled: false,
      actionKilled: true,
      reason: `Action kill-switch active: ${envKey}=true`,
      source: 'env',
    }
  }

  // 3. DB override (cached)
  const cached = overrideCache.get(actionType)
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.killed) {
      return {
        globalKilled: false,
        actionKilled: true,
        reason: cached.reason,
        source: 'db',
      }
    }
  }

  return {
    globalKilled: false,
    actionKilled: false,
    reason: null,
    source: null,
  }
}

// ── DB override management ──────────────────────────────────────────────────

/**
 * Set a kill-switch override via DB (for hot-toggle from admin dashboard).
 * Updates the in-memory cache immediately.
 */
export async function setKillSwitchOverride(opts: {
  actionType: string
  killed: boolean
  reason: string
  actor: string
  orgId?: string
}): Promise<void> {
  // Update cache immediately
  overrideCache.set(opts.actionType, {
    killed: opts.killed,
    reason: opts.reason,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  // Audit the toggle
  await appendAiAuditEvent({
    orgId: opts.orgId ?? 'platform',
    actorClerkUserId: opts.actor,
    action: opts.killed ? 'ai.kill_switch_activated' : 'ai.kill_switch_deactivated',
    targetType: 'ai_action',
    afterJson: {
      actionType: opts.actionType,
      killed: opts.killed,
      reason: opts.reason,
    },
  })

  // Emit telemetry
  emitAiMetric({
    appKey: 'platform',
    feature: 'kill_switch',
    event: opts.killed ? 'activated' : 'deactivated',
    actionType: opts.actionType,
    reason: opts.reason,
    actor: opts.actor,
  })
}

/**
 * Clear all cached overrides (e.g. after a system restart).
 */
export function clearKillSwitchCache(): void {
  overrideCache.clear()
}

/**
 * Get current kill-switch status for all action types (for dashboard).
 */
export function getKillSwitchDashboard(): Record<string, KillSwitchStatus> {
  const dashboard: Record<string, KillSwitchStatus> = {}

  // Check global
  const globalKilled = process.env.AI_KILL_SWITCH === 'true'

  // Collect all known action types from cache
  for (const [actionType, cached] of overrideCache) {
    dashboard[actionType] = {
      globalKilled,
      actionKilled: cached.killed,
      reason: globalKilled ? 'Global AI kill-switch active' : (cached.killed ? cached.reason : null),
      source: globalKilled ? 'env' : (cached.killed ? 'db' : null),
    }
  }

  return dashboard
}
