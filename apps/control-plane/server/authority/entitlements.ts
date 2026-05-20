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
  /**
   * Where the resolution came from. Distinct values let auditors tell apart:
   *   - `subscription`: live `org_entitlements` row (not yet implemented).
   *   - `override`: open-mode (dev/demo only) — every feature granted.
   *   - `default`: matched the conservative `defaults` allow-list.
   *   - `stub`: stub mode is active but feature is outside the defaults.
   *   - `denied`: org missing, error, or feature not granted by any source.
   *   - `not_configured`: production boot did not declare an entitlement
   *     source — denied with `ENTITLEMENT_SOURCE_NOT_CONFIGURED`.
   */
  source: 'subscription' | 'override' | 'default' | 'stub' | 'denied' | 'not_configured'
  reasonCode?: string
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
 * Resolved entitlement source declared by the operator. Production deploys
 * MUST set `CONTROL_PLANE_ENTITLEMENT_SOURCE` to one of:
 *   - `stub`     — conservative default allow-list only (current behaviour);
 *                  acknowledges that the real source is not yet wired.
 *   - `open`     — every feature granted (requires `*_ALLOW_OPEN_*=1`).
 *   - `db`       — read live entitlements from the `org_entitlements`
 *                  table via `server/adapters/entitlements-db.ts`. Rows
 *                  with NULL `expires_at` (or an expiry in the future)
 *                  grant the feature; missing rows deny with
 *                  `FEATURE_NOT_ENTITLED`.
 * In non-production, an unset value defaults to `stub` so dev/test/demo keep
 * working. In production, an unset value resolves to `not_configured` and
 * every entitlement query is denied with a stable reason code.
 */
type EntitlementSource = 'stub' | 'open' | 'db' | 'not_configured'

function getDeclaredEntitlementSource(): EntitlementSource {
  const raw = (process.env.CONTROL_PLANE_ENTITLEMENT_SOURCE ?? '').trim().toLowerCase()
  if (raw === 'stub' || raw === 'open' || raw === 'db') return raw
  if (raw.length > 0) {
    logger.warn('Unknown CONTROL_PLANE_ENTITLEMENT_SOURCE value — treating as not_configured', { raw })
    return 'not_configured'
  }
  // Backwards-compatible default: non-prod keeps the conservative stub so
  // existing dev/test/staging flows do not regress. Production refuses to
  // resolve until the operator explicitly declares a source.
  return process.env.NODE_ENV === 'production' ? 'not_configured' : 'stub'
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

  // ── Production boot guard ──────────────────────────────────────────────
  // Refuse to resolve in production when the operator has not explicitly
  // declared an entitlement source. This converts a silently-permissive
  // "only the conservative defaults work" state into a loud denial with a
  // stable reason code that monitoring can alert on.
  const declaredSource = getDeclaredEntitlementSource()
  if (declaredSource === 'not_configured') {
    logger.error('Entitlement source not configured — denying by default', {
      orgId: query.orgId,
      feature: query.feature,
      decisionId,
    })
    await recordAuditEvent({
      orgId: query.orgId,
      actorClerkUserId: query.actorId ?? 'system',
      action: AUDIT_ACTIONS.POLICY_DENIED,
      targetType: 'entitlement',
      targetId: query.feature,
      afterJson: {
        feature: query.feature,
        granted: false,
        decisionId,
        source: 'not_configured',
        reasonCode: 'ENTITLEMENT_SOURCE_NOT_CONFIGURED',
      },
    })
    return {
      orgId: query.orgId,
      feature: query.feature,
      granted: false,
      tier: null,
      limit: null,
      expiresAt: null,
      source: 'not_configured',
      reasonCode: 'ENTITLEMENT_SOURCE_NOT_CONFIGURED',
      resolvedAt,
      decisionId,
    }
  }
  if (declaredSource === 'db') {
    try {
      const { resolveEntitlementFromDb } = await import(
        '@/server/adapters/entitlements-db'
      )
      const { orgs } = await import('@nzila/db/schema')
      const { eq } = await import('drizzle-orm')

      const org = await platformDb
        .select({ id: orgs.id })
        .from(orgs)
        .where(eq(orgs.id, query.orgId))
        .limit(1)
        .then((rows) => rows[0] ?? null)

      if (!org) {
        await recordAuditEvent({
          orgId: query.orgId,
          actorClerkUserId: query.actorId ?? 'system',
          action: AUDIT_ACTIONS.POLICY_DENIED,
          targetType: 'entitlement',
          targetId: query.feature,
          afterJson: {
            feature: query.feature,
            granted: false,
            decisionId,
            source: 'denied',
            reasonCode: 'ORG_NOT_FOUND',
          },
        })
        return {
          orgId: query.orgId,
          feature: query.feature,
          granted: false,
          tier: null,
          limit: null,
          expiresAt: null,
          source: 'denied',
          reasonCode: 'ORG_NOT_FOUND',
          resolvedAt,
          decisionId,
        }
      }

      const row = await resolveEntitlementFromDb(
        platformDb as unknown as Parameters<typeof resolveEntitlementFromDb>[0],
        query.orgId,
        query.feature,
      )

      if (!row) {
        await recordAuditEvent({
          orgId: query.orgId,
          actorClerkUserId: query.actorId ?? 'system',
          action: AUDIT_ACTIONS.POLICY_DENIED,
          targetType: 'entitlement',
          targetId: query.feature,
          afterJson: {
            feature: query.feature,
            granted: false,
            decisionId,
            source: 'denied',
            reasonCode: 'FEATURE_NOT_ENTITLED',
          },
        })
        return {
          orgId: query.orgId,
          feature: query.feature,
          granted: false,
          tier: null,
          limit: null,
          expiresAt: null,
          source: 'denied',
          reasonCode: 'FEATURE_NOT_ENTITLED',
          resolvedAt,
          decisionId,
        }
      }

      await recordAuditEvent({
        orgId: query.orgId,
        actorClerkUserId: query.actorId ?? 'system',
        action: AUDIT_ACTIONS.POLICY_ALLOWED,
        targetType: 'entitlement',
        targetId: query.feature,
        afterJson: {
          feature: query.feature,
          granted: true,
          decisionId,
          source: 'subscription',
          tier: row.tier,
        },
      })
      return {
        orgId: query.orgId,
        feature: query.feature,
        granted: true,
        tier: row.tier,
        limit: row.limit,
        expiresAt: row.expiresAt,
        source: 'subscription',
        resolvedAt,
        decisionId,
      }
    } catch (err) {
      logger.error('Entitlement DB resolution failed', {
        orgId: query.orgId,
        feature: query.feature,
        decisionId,
        error: err,
      })
      return {
        orgId: query.orgId,
        feature: query.feature,
        granted: false,
        tier: null,
        limit: null,
        expiresAt: null,
        source: 'denied',
        reasonCode: 'ENTITLEMENT_RESOLUTION_ERROR',
        resolvedAt,
        decisionId,
      }
    }
  }

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
    const openModeRequested = declaredSource === 'open' || isOpenEntitlementMode()
    const openMode = openModeRequested && isOpenEntitlementMode()
    const defaults = getDefaultFeatures()
    const inDefaults = defaults.has(query.feature)
    const granted = orgActive && (openMode || inDefaults)
    const source: EntitlementResult['source'] = !orgActive
      ? 'denied'
      : openMode
        ? 'override'
        : inDefaults
          ? 'default'
          : 'stub'
    const reasonCode = granted
      ? undefined
      : !orgActive
        ? 'ORG_NOT_FOUND'
        : 'FEATURE_NOT_IN_DEFAULT_ENTITLEMENTS'

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
      reasonCode,
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
      reasonCode: 'ENTITLEMENT_RESOLUTION_ERROR',
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
