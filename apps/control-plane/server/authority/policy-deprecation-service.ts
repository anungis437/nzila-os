/**
 * Policy Deprecation Service — Lifecycle health monitoring.
 *
 * Provides proactive identification of governance debt:
 *
 *  1. Stale drafts — policies that have been in draft for >30 days
 *  2. Past review cadence — active policies whose next_review_due is overdue
 *  3. Orphaned workflows — workflows bound to deprecated/revoked policies
 *     with no replacement
 *  4. Stale ownership — policies whose authors are no longer in the system
 *
 * This service is read-only by default. Actual deprecation state transitions
 * are performed by calling governed-policy-service.transitionState().
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  governedPolicies,
  type GovernedPolicyRow,
} from '@nzila/db/schema'
import { eq, and, lt, lte, or } from 'drizzle-orm'

const logger = createLogger('control-plane:authority:policy-deprecation-service')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeprecationCandidate {
  policyId: string
  policyFamilyId: string
  semver: string
  name: string
  domain: string
  lifecycleStatus: string
  riskClassification: string
  reason: 'stale_draft' | 'overdue_review' | 'expired_effective_until'
  reasonDetail: string
  daysSinceActivity: number
  suggestedAction: 'archive' | 'review' | 'extend' | 'deprecate'
}

export interface OrphanedWorkflow {
  workflowId: string
  boundPolicyId: string
  boundPolicyName: string
  boundPolicyStatus: string
  replacementPolicyId: string | null
}

export interface StaleOwnershipReport {
  policyId: string
  policyName: string
  authorId: string
  authorRole: string
  domain: string
  lifecycleStatus: string
  lastReviewedAt: Date | null
  daysSinceReview: number
}

// ── Stale draft detection ─────────────────────────────────────────────────────

const STALE_DRAFT_THRESHOLD_DAYS = 30

/**
 * Find policies that should be candidates for deprecation or archival.
 */
export async function getDeprecationCandidates(db: AnyDB): Promise<DeprecationCandidate[]> {
  const now = new Date()
  const staleDraftThreshold = new Date(now.getTime() - STALE_DRAFT_THRESHOLD_DAYS * 86_400_000)

  const candidates: DeprecationCandidate[] = []

  // ── Stale drafts ─────────────────────────────────────────────────────────
  const staleDrafts: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(
      and(
        eq(governedPolicies.lifecycleStatus, 'draft'),
        lt(governedPolicies.createdAt, staleDraftThreshold),
      ),
    )

  for (const policy of staleDrafts) {
    const daysSince = Math.floor(
      (now.getTime() - policy.createdAt.getTime()) / 86_400_000,
    )
    candidates.push({
      policyId: policy.id,
      policyFamilyId: policy.policyFamilyId,
      semver: policy.semver,
      name: policy.name,
      domain: policy.domain,
      lifecycleStatus: policy.lifecycleStatus,
      riskClassification: policy.riskClassification,
      reason: 'stale_draft',
      reasonDetail: `Draft has been inactive for ${daysSince} days (threshold: ${STALE_DRAFT_THRESHOLD_DAYS} days).`,
      daysSinceActivity: daysSince,
      suggestedAction: 'archive',
    })
  }

  // ── Overdue review ────────────────────────────────────────────────────────
  const overdueReview: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(
      and(
        eq(governedPolicies.lifecycleStatus, 'active'),
        lte(governedPolicies.nextReviewDue, now),
      ),
    )

  for (const policy of overdueReview) {
    const daysSince = policy.nextReviewDue
      ? Math.floor((now.getTime() - policy.nextReviewDue.getTime()) / 86_400_000)
      : 0
    candidates.push({
      policyId: policy.id,
      policyFamilyId: policy.policyFamilyId,
      semver: policy.semver,
      name: policy.name,
      domain: policy.domain,
      lifecycleStatus: policy.lifecycleStatus,
      riskClassification: policy.riskClassification,
      reason: 'overdue_review',
      reasonDetail: `Review was due ${daysSince} day(s) ago. Cadence: every ${policy.reviewCadenceDays} days.`,
      daysSinceActivity: daysSince,
      suggestedAction: 'review',
    })
  }

  // ── Expired effective_until ───────────────────────────────────────────────
  const expired: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(
      and(
        or(
          eq(governedPolicies.lifecycleStatus, 'active'),
          eq(governedPolicies.lifecycleStatus, 'published'),
        ),
        lte(governedPolicies.effectiveUntil, now),
      ),
    )

  for (const policy of expired) {
    const daysSince = policy.effectiveUntil
      ? Math.floor((now.getTime() - policy.effectiveUntil.getTime()) / 86_400_000)
      : 0
    candidates.push({
      policyId: policy.id,
      policyFamilyId: policy.policyFamilyId,
      semver: policy.semver,
      name: policy.name,
      domain: policy.domain,
      lifecycleStatus: policy.lifecycleStatus,
      riskClassification: policy.riskClassification,
      reason: 'expired_effective_until',
      reasonDetail: `effective_until expired ${daysSince} day(s) ago.`,
      daysSinceActivity: daysSince,
      suggestedAction: 'deprecate',
    })
  }

  logger.info('deprecation candidates computed', { count: candidates.length })
  return candidates
}

// ── Scheduled deprecation ─────────────────────────────────────────────────────

export interface ScheduleDeprecationInput {
  policyId: string
  sunsetDate: Date
  replacementPolicyId?: string | null
  actorId: string
}

/**
 * Schedule a policy for deprecation by setting its effective_until date.
 * The actual state transition to 'deprecated' must be triggered separately
 * (by a cron or manual admin action) after the sunsetDate is reached.
 */
export async function scheduleDeprecation(
  input: ScheduleDeprecationInput,
  db: AnyDB,
  _correlationId?: string,
): Promise<GovernedPolicyRow> {
  const [updated] = await db
    .update(governedPolicies)
    .set({
      effectiveUntil: input.sunsetDate,
      ...(input.replacementPolicyId
        ? { supersededBy: input.replacementPolicyId }
        : {}),
    })
    .where(eq(governedPolicies.id, input.policyId))
    .returning()

  logger.info('deprecation scheduled', {
    policyId: input.policyId,
    sunsetDate: input.sunsetDate.toISOString(),
    replacementPolicyId: input.replacementPolicyId,
  })

  return updated as GovernedPolicyRow
}

// ── Orphaned workflow detection ───────────────────────────────────────────────

/**
 * Detect workflows that are bound to deprecated, revoked, or archived policies
 * with no active replacement.
 *
 * An "orphaned" workflow is one where:
 *  - The binding policy is in a retired state
 *  - Either superseded_by is null, or the replacement is not active
 */
export async function detectOrphanedWorkflows(db: AnyDB): Promise<OrphanedWorkflow[]> {
  const retiredPolicies: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(
      or(
        eq(governedPolicies.lifecycleStatus, 'deprecated'),
        eq(governedPolicies.lifecycleStatus, 'revoked'),
        eq(governedPolicies.lifecycleStatus, 'superseded'),
      ),
    )

  const orphaned: OrphanedWorkflow[] = []

  for (const policy of retiredPolicies) {
    const bindings = extractWorkflowBindings(policy)
    if (bindings.length === 0) continue

    // Check if there's an active replacement
    let replacementId: string | null = null
    if (policy.supersededBy) {
      const [replacement] = await db
        .select()
        .from(governedPolicies)
        .where(
          and(
            eq(governedPolicies.id, policy.supersededBy),
            eq(governedPolicies.lifecycleStatus, 'active'),
          ),
        )
        .limit(1)
      if (replacement) {
        replacementId = policy.supersededBy
      }
    }

    if (!replacementId) {
      for (const wfId of bindings) {
        orphaned.push({
          workflowId: wfId,
          boundPolicyId: policy.id,
          boundPolicyName: policy.name,
          boundPolicyStatus: policy.lifecycleStatus,
          replacementPolicyId: policy.supersededBy ?? null,
        })
      }
    }
  }

  if (orphaned.length > 0) {
    logger.warn('orphaned workflows detected', { count: orphaned.length })
  }

  return orphaned
}

// ── Stale ownership ───────────────────────────────────────────────────────────

/**
 * Find active policies where the author has not reviewed the policy within
 * 2x the review cadence period.
 *
 * This is a heuristic — actual user existence validation requires a user
 * service lookup (not done here to avoid cross-service coupling).
 */
export async function detectStaleOwnership(db: AnyDB): Promise<StaleOwnershipReport[]> {
  const now = new Date()

  const activePolicies: GovernedPolicyRow[] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.lifecycleStatus, 'active'))

  const reports: StaleOwnershipReport[] = []

  for (const policy of activePolicies) {
    const cadenceMs = (policy.reviewCadenceDays ?? 365) * 2 * 86_400_000
    const staleThreshold = new Date(now.getTime() - cadenceMs)

    const lastReview = policy.lastReviewedAt
    if (!lastReview || lastReview < staleThreshold) {
      const daysSince = lastReview
        ? Math.floor((now.getTime() - lastReview.getTime()) / 86_400_000)
        : Math.floor((now.getTime() - policy.createdAt.getTime()) / 86_400_000)

      reports.push({
        policyId: policy.id,
        policyName: policy.name,
        authorId: policy.authorId,
        authorRole: policy.authorRole,
        domain: policy.domain,
        lifecycleStatus: policy.lifecycleStatus,
        lastReviewedAt: lastReview ?? null,
        daysSinceReview: daysSince,
      })
    }
  }

  return reports
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractWorkflowBindings(policy: GovernedPolicyRow): string[] {
  if (!policy.workflowBindings) return []
  if (Array.isArray(policy.workflowBindings)) {
    return policy.workflowBindings.filter((v): v is string => typeof v === 'string')
  }
  return []
}
