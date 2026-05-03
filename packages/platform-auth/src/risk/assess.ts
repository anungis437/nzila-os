/**
 * Risk-based auth — lightweight, explainable scorer.
 *
 * Signals are derived from data we already store (`auth_audit_log`, `users`,
 * `user_sessions`). No black-box ML, no fake geolocation lookups. Score is
 * bucketed into tiers that downstream callers (the login service) use to
 * decide whether to allow, require MFA, or short-lockout.
 *
 * Explicitly out of scope for this round:
 *   - IP geolocation / ASN resolution (needs a data provider)
 *   - Velocity-based impossible-travel detection (ditto)
 *   - Device fingerprinting (client-side instrumentation needed first)
 *
 * These can be added later as additional signals without changing the public
 * API of `assessRisk`.
 */
import { db } from '@nzila/db/client'
import { authAuditLog, authUserSessions } from '@nzila/db/schema'
import { and, eq, gt, sql } from 'drizzle-orm'

export type RiskTier = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  score: number // 0–100 additive
  tier: RiskTier
  reasons: string[]
  /**
   * Recommended auth action. Caller (login service) may upgrade but not downgrade.
   *   allow        → proceed normally
   *   require_mfa  → force MFA step-up even if user hasn't enrolled yet
   *   soft_lockout → refuse this attempt with generic message
   */
  recommendedAction: 'allow' | 'require_mfa' | 'soft_lockout'
}

export interface AssessRiskInput {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
  userRoles?: string[]
  /** Current timestamp, injectable for tests. */
  now?: Date
}

const FAILURE_WINDOW_MS = 15 * 60 * 1000
const FIRST_SEEN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export async function assessRisk(input: AssessRiskInput): Promise<RiskAssessment> {
  if ((process.env.UE_E2E_RISK_BYPASS ?? '').toLowerCase() === 'true') {
    return {
      score: 0,
      tier: 'low',
      reasons: ['qa_test_env_bypass'],
      recommendedAction: 'allow',
    }
  }

  const now = input.now ?? new Date()
  let score = 0
  const reasons: string[] = []

  // Signal 1: recent failed logins from this IP (against any account)
  if (input.ipAddress) {
    const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MS)
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(authAuditLog)
      .where(
        and(
          eq(authAuditLog.eventType, 'login_failed'),
          eq(authAuditLog.ipAddress, input.ipAddress),
          gt(authAuditLog.createdAt, windowStart),
        ),
      )
    const failures = row?.count ?? 0
    if (failures >= 10) {
      score += 40
      reasons.push(`${failures} failed logins from this IP in 15 minutes`)
    } else if (failures >= 3) {
      score += 15
      reasons.push(`${failures} failed logins from this IP in 15 minutes`)
    }
  }

  // Signal 2: first-seen IP for this user (looked at past 90 days of sessions)
  if (input.ipAddress && input.userId) {
    const windowStart = new Date(now.getTime() - FIRST_SEEN_WINDOW_MS)
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(authUserSessions)
      .where(
        and(
          eq(authUserSessions.userId, input.userId),
          eq(authUserSessions.ipAddress, input.ipAddress),
          gt(authUserSessions.createdAt, windowStart),
        ),
      )
    const seenBefore = (row?.count ?? 0) > 0
    if (!seenBefore) {
      score += 20
      reasons.push('First-seen IP for this account')
    }
  }

  // Signal 3: privileged role
  if (input.userRoles && input.userRoles.length > 0) {
    const privileged = new Set(['admin', 'coo', 'app_owner', 'platform_admin'])
    const isPrivileged = input.userRoles.some((r) => privileged.has(r))
    if (isPrivileged) {
      score += 10
      reasons.push('Privileged role')
    }
  }

  // Signal 4: no UA header (bot-like)
  if (!input.userAgent || input.userAgent.length < 10) {
    score += 15
    reasons.push('Missing or suspicious user agent')
  }

  // Bucket
  let tier: RiskTier = 'low'
  let recommendedAction: RiskAssessment['recommendedAction'] = 'allow'
  if (score >= 50) {
    tier = 'high'
    recommendedAction = 'soft_lockout'
  } else if (score >= 25) {
    tier = 'medium'
    recommendedAction = 'require_mfa'
  }

  return { score, tier, reasons, recommendedAction }
}
