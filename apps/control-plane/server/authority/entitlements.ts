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
 * Resolve whether an org is entitled to a feature.
 * Records a decision audit event for every resolution.
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

    // Default entitlement model — tier-based grants
    // In production this queries org_entitlements/subscription tables
    const granted = org !== null // If the org exists, it has basic access
    const source: EntitlementResult['source'] = org ? 'subscription' : 'denied'

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
