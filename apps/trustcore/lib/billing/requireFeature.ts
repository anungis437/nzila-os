/**
 * TrustCore — Centralized Feature Gate
 *
 * requireFeature(orgId, feature)
 *
 * Single source of truth for all billing enforcement.
 * Replaces ad-hoc per-route gating.
 *
 * Throws a structured FeatureGateError when access is denied.
 * API routes catch this error and return 403 with a consistent shape.
 *
 * Usage:
 *   await requireFeature(orgId, 'audit_export')
 *   await requireFeature(orgId, 'evidence_export')
 *   await requireFeature(orgId, 'trust_center')
 *   await requireFeature(orgId, 'reminders', activeCount)
 */

import { getResolvedSubscription } from './getSubscription'
import { getTrustcoreBillingService } from '@/lib/platform/billing'
import {
  gateAuditExport,
  gateEvidenceExport,
  gateTrustCenter,
  gateReminderCreate,
  TRUSTCORE_FEATURE_KEYS,
  type GateResult,
} from './featureAccess'

// ── Feature identifiers ────────────────────────────────────────────────────

export type GatedFeature =
  | 'audit_export'
  | 'evidence_export'
  | 'trust_center'
  | 'reminders'

// ── Structured error ───────────────────────────────────────────────────────

export class FeatureGateError extends Error {
  readonly error: 'upgrade_required' | 'limit_reached'
  readonly feature: GatedFeature

  constructor(result: GateResult & { feature: GatedFeature }) {
    super(result.message ?? `Feature '${result.feature}' requires a plan upgrade.`)
    this.name = 'FeatureGateError'
    this.error = result.error as 'upgrade_required' | 'limit_reached'
    this.feature = result.feature
  }

  /** Serialized 403 payload — matches the contract across all gated routes. */
  toResponse(): { error: string; feature: string; message?: string } {
    return { error: this.error, feature: this.feature, message: this.message }
  }
}

// ── Gate resolver ──────────────────────────────────────────────────────────

/**
 * Resolves the subscription for `orgId` and checks whether `feature` is
 * accessible.
 *
 * @throws {FeatureGateError} When the feature is not available on the org's plan.
 *
 * @param orgId       The org to check.
 * @param feature     The feature being accessed.
 * @param extraArg    For 'reminders': the current active reminder count.
 */
export async function requireFeature(
  orgId: string,
  feature: GatedFeature,
  extraArg?: number,
): Promise<void> {
  const billingService = getTrustcoreBillingService()
  const entitlement = await billingService.checkEntitlement(orgId, TRUSTCORE_FEATURE_KEYS[feature])
  if (!entitlement.active) {
    throw new FeatureGateError({
      allowed: false,
      error: feature === 'reminders' ? 'limit_reached' : 'upgrade_required',
      feature,
      message:
        feature === 'reminders'
          ? 'Upgrade to Pro for unlimited reminders.'
          : `Feature '${feature}' requires a plan upgrade.`,
    })
  }

  const subscription = await getResolvedSubscription(orgId)

  let result: GateResult

  switch (feature) {
    case 'audit_export':
      result = gateAuditExport(subscription)
      break
    case 'evidence_export':
      result = gateEvidenceExport(subscription)
      break
    case 'trust_center':
      result = gateTrustCenter(subscription)
      break
    case 'reminders':
      result = gateReminderCreate(subscription, extraArg ?? 0)
      break
    default: {
      const _exhaustive: never = feature
      throw new Error(`Unknown feature: ${String(_exhaustive)}`)
    }
  }

  if (!result.allowed) {
    throw new FeatureGateError({
      ...result,
      feature,
    })
  }
}
