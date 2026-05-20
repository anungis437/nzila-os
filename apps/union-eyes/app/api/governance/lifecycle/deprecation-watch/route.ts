/**
 * GET /api/governance/lifecycle/deprecation-watch
 */
import { withApi } from '@/lib/api/framework'
import { db } from '@/db/db'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { governedPolicies } from '@nzila/db/schema'
import { eq, lt, and, or, isNull, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
  },
  async () => {
    return withSystemContext(async () => {
      const nineDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      // Stale drafts (created 90+ days ago and not yet published)
      const staleDrafts = await db
        .select()
        .from(governedPolicies)
        .where(
          and(
            eq(governedPolicies.lifecycleStatus, 'draft'),
            lt(governedPolicies.createdAt, nineDaysAgo),
          ),
        )

      // Deprecated policies still marked active (should be superseded)
      const staleDeprecated = await db
        .select()
        .from(governedPolicies)
        .where(eq(governedPolicies.lifecycleStatus, 'deprecated'))

      // Active policies without a named reviewer (lastReviewedBy is null)
      const staleOwnership = await db
        .select()
        .from(governedPolicies)
        .where(
          and(
            or(
              eq(governedPolicies.lifecycleStatus, 'active'),
              eq(governedPolicies.lifecycleStatus, 'published'),
            ),
            isNull(governedPolicies.lastReviewedBy),
          ),
        )

      // Overdue reviews (review_cadence_days exceeded without review)
      const overdueReviews = await db
        .select()
        .from(governedPolicies)
        .where(
          and(
            or(
              eq(governedPolicies.lifecycleStatus, 'active'),
              eq(governedPolicies.lifecycleStatus, 'published'),
            ),
            lt(
              governedPolicies.activatedAt,
              sql`NOW() - (review_cadence_days || ' days')::interval`,
            ),
          ),
        )

      return {
        candidates: staleDrafts.map((p) => ({ policy: p, reason: 'stale_draft' })),
        deprecated: staleDeprecated.map((p) => ({ policy: p, reason: 'deprecated' })),
        staleOwnership: staleOwnership.map((p) => ({ policy: p, reason: 'no_owner' })),
        overdueReviews: overdueReviews.map((p) => ({ policy: p, reason: 'overdue_review' })),
        orphaned: [],
        staleDaysThreshold: 90,
        queriedAt: new Date().toISOString(),
      }
    })
  },
)
