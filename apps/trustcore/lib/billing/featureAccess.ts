/**
 * TrustCore — Feature Access / Plan Gating
 *
 * Authoritative feature gate for all TrustCore billing tiers.
 * Called at both API and UI layers — enforcement is at the API layer.
 *
 * FREE:
 *   - max 10 active reminders
 *   - no audit export
 *   - no trust center public page
 *
 * PRO:
 *   - unlimited reminders
 *   - audit export (JSON + PDF)
 *   - evidence export
 *   - trust center enabled
 *
 * PREMIUM:
 *   - everything in PRO (future additions go here)
 */

import type { ResolvedSubscription, Plan } from './getSubscription'

export const TRUSTCORE_FEATURE_KEYS = {
  audit_export: 'audit_export',
  evidence_export: 'evidence_export',
  trust_center: 'trust_center',
  reminders: 'reminders',
} as const

// ── Constants ──────────────────────────────────────────────────────────────

export const FREE_REMINDER_LIMIT = 10

// ── Plan tier helpers ──────────────────────────────────────────────────────

function isPro(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

// ── Access checks ──────────────────────────────────────────────────────────

/**
 * Can this org export the audit report (JSON or PDF)?
 * Requires PRO or PREMIUM and an active subscription.
 */
export function canExportAudit(subscription: ResolvedSubscription): boolean {
  return isPro(subscription.plan) && subscription.isActive
}

/**
 * Can this org access (and share) the public Trust Center page?
 * Requires PRO or PREMIUM and an active subscription.
 */
export function canAccessTrustCenter(subscription: ResolvedSubscription): boolean {
  return isPro(subscription.plan) && subscription.isActive
}

/**
 * Can this org export the evidence bundle?
 * Requires PRO or PREMIUM and an active subscription.
 */
export function canExportEvidence(subscription: ResolvedSubscription): boolean {
  return isPro(subscription.plan) && subscription.isActive
}

/**
 * Can this org create a new reminder, given the current active count?
 *
 * FREE orgs are limited to FREE_REMINDER_LIMIT active reminders.
 * PRO/PREMIUM orgs have no limit.
 */
export function canCreateReminder(
  subscription: ResolvedSubscription,
  currentActiveCount: number,
): boolean {
  if (isPro(subscription.plan)) return true
  return currentActiveCount < FREE_REMINDER_LIMIT
}

// ── Structured gate result ─────────────────────────────────────────────────

export interface GateResult {
  allowed: boolean
  error?: 'upgrade_required' | 'limit_reached'
  feature?: string
  message?: string
}

export function gateAuditExport(subscription: ResolvedSubscription): GateResult {
  if (canExportAudit(subscription)) return { allowed: true }
  return {
    allowed: false,
    error: 'upgrade_required',
    feature: 'audit_export',
    message: 'Upgrade to Pro to unlock audit export.',
  }
}

export function gateTrustCenter(subscription: ResolvedSubscription): GateResult {
  if (canAccessTrustCenter(subscription)) return { allowed: true }
  return {
    allowed: false,
    error: 'upgrade_required',
    feature: 'trust_center',
    message: 'Upgrade to Pro to enable your public Trust Center.',
  }
}

export function gateEvidenceExport(subscription: ResolvedSubscription): GateResult {
  if (canExportEvidence(subscription)) return { allowed: true }
  return {
    allowed: false,
    error: 'upgrade_required',
    feature: 'evidence_export',
    message: 'Upgrade to Pro to export your evidence bundle.',
  }
}

export function gateReminderCreate(
  subscription: ResolvedSubscription,
  currentActiveCount: number,
): GateResult {
  if (canCreateReminder(subscription, currentActiveCount)) return { allowed: true }
  return {
    allowed: false,
    error: 'limit_reached',
    feature: 'reminders',
    message: `Free plan allows up to ${FREE_REMINDER_LIMIT} active reminders. Upgrade to Pro for unlimited reminders.`,
  }
}
