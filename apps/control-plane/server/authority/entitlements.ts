/**
 * Control Plane — Entitlement Resolution Authority
 *
 * The SINGLE canonical source for resolving org entitlements and feature access.
 * No other app may evaluate entitlements directly.
 *
 * All callers must use the Control Plane API endpoint:
 *   POST /api/control-plane/authority/entitlements
 */
import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { createLogger } from '@nzila/os-core'
import type { ActorIdentity } from '@nzila/platform-contracts/control-system'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'

const logger = createLogger('control-plane:authority:entitlements')

// ── Types ────────────────────────────────────────────────────────────────────

export interface EntitlementQuery {
  orgId: string
  feature: string
  actorId?: string
}

export interface EntitlementResult {
  orgId: string
  feature: string
  granted: boolean
  tier: string | null
  limit: number | null
  expiresAt: string | null
  source: 'subscription' | 'override' | 'default' | 'denied'
  resolvedAt: string
  decisionId: string
}

// ── Entitlement resolution ───────────────────────────────────────────────────

/**
 * Default entitlement set granted to any active org until a real subscription
 * source (org_entitlements / billing) is wired in. Kept intentionally small so
 * stub mode does not silently leak premium capabilities.
 *
 * Override by setting `CONTROL_PLANE_DEFAULT_ENTITLEMENTS` to a comma-separated
 * list, or by setting `CONTROL_PLANE_ENTITLEMENTS_OPEN=1` (dev/demo only) to
 * grant every feature.
 */
const FALLBACK_DEFAULT_FEATURES: ReadonlySet<string> = new Set([
  'core.read',
  'core.basic',
])

function getDefaultFeatures(): ReadonlySet<string> {
  const raw = process.env.CONTROL_PLANE_DEFAULT_ENTITLEMENTS
  if (!raw) return FALLBACK_DEFAULT_FEATURES
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length > 0 ? new Set(items) : FALLBACK_DEFAULT_FEATURES
}

function isOpenEntitlementMode(): boolean {
  const flag = process.env.CONTROL_PLANE_ENTITLEMENTS_OPEN
  if (flag === '1' || flag === 'true') {
    if (process.env.NODE_ENV === 'production' && process.env.CONTROL_PLANE_ALLOW_OPEN_ENTITLEMENTS_IN_PROD !== '1') {
      logger.warn('CONTROL_PLANE_ENTITLEMENTS_OPEN ignored in production', {})
      return false
    }
    return true
  }
  if (flag === '0' || flag === 'false') return false
  // Default: open in non-production (preserves legacy behaviour for dev/test/
  // staging/demo until a real entitlement source is wired in), closed in
  // production so missing config fails safely as deny-by-default.
  return process.env.NODE_ENV !== 'production'
}

/**
 * Resolve whether an org is entitled to a feature.
 * Records a decision audit event for every resolution.
 *
 * NOTE: This is a stub implementation pending a real org_entitlements /
 * subscription table. It grants only the features listed in
 * `CONTROL_PLANE_DEFAULT_ENTITLEMENTS` (or a hardcoded conservative default
 * set) to any active org, and denies everything else by default. Set
 * `CONTROL_PLANE_ENTITLEMENTS_OPEN=1` in non-production to restore the legacy
 * "any active org gets any feature" behaviour.
 */
export async function resolveEntitlements(
  query: EntitlementQuery,
): Promise<EntitlementResult> {
  const decisionId = crypto.randomUUID()
  const resolvedAt = new Date().toISOString()

  logger.info('Resolving entitlement', {
    orgId: query.orgId,
    feature: query.feature,
    decisionId,
  })

  try {
    // Query the platform DB for org entitlements
    // Falls back gracefully if no entitlement record exists
    const { orgs } = await import('@nzila/db/schema')
    const { eq } = await import('drizzle-orm')

    const org = await platformDb
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.id, query.orgId))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    // Stub model: org existence is a precondition, not the entitlement itself.
    // Until a real subscription/entitlement source is wired in, only the
    // conservative default feature set is granted.
    const orgActive = org !== null
    const openMode = isOpenEntitlementMode()
    const defaults = getDefaultFeatures()
    const granted = orgActive && (openMode || defaults.has(query.feature))
    const source: EntitlementResult['source'] = !orgActive
      ? 'denied'
      : openMode
        ? 'override'
        : granted
          ? 'default'
          : 'denied'

    await recordAuditEvent({
      orgId: query.orgId,
      actorClerkUserId: query.actorId ?? 'system',
      action: granted ? AUDIT_ACTIONS.POLICY_ALLOWED : AUDIT_ACTIONS.POLICY_DENIED,
      targetType: 'entitlement',
      targetId: query.feature,
      afterJson: { feature: query.feature, granted, decisionId, source },
    })

    return {
      orgId: query.orgId,
      feature: query.feature,
      granted,
      tier: null,
      limit: null,
      expiresAt: null,
      source,
      resolvedAt,
      decisionId,
    }
  } catch (err) {
    logger.error('Entitlement resolution failed', {
      orgId: query.orgId,
      feature: query.feature,
      error: err,
    })
    // Safe fallback: deny on error
    return {
      orgId: query.orgId,
      feature: query.feature,
      granted: false,
      tier: null,
      limit: null,
      expiresAt: null,
      source: 'denied',
      resolvedAt,
      decisionId,
    }
  }
}

/**
 * Bulk-resolve multiple entitlements for an org in a single call.
 */
export async function resolveEntitlementsBulk(
  orgId: string,
  features: string[],
  actorId?: string,
): Promise<Record<string, EntitlementResult>> {
  const results = await Promise.all(
    features.map((feature) => resolveEntitlements({ orgId, feature, actorId })),
  )
  return Object.fromEntries(results.map((r) => [r.feature, r]))
}
