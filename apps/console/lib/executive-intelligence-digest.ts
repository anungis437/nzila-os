/**
 * Reads from the learning-loop tables to surface a compact "what matters now"
 * panel for the weekly briefing: top-ranked recommendations, what changed
 * vs the previous snapshot, and a quiet "one thing to ignore".
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  executiveRecommendations,
  executivePrioritySnapshots,
} from '@nzila/db/schema'

export interface TopPriority {
  id: string
  title: string
  rankScore: number
  rankBucket: string
  kind: 'risk' | 'opportunity' | 'task' | string
  narrative: string
}

export interface PriorityDiff {
  newTop: TopPriority[] // in current top-N but not previous
  droppedFromTop: { id: string; title: string; previousScore: number }[]
  oneToIgnore: TopPriority | null // lowest-score open rec in backlog/this_month
}

export interface IntelligenceDigest {
  topPriorities: TopPriority[]
  diff: PriorityDiff
  activeRiskCount: number
  activeOpportunityCount: number
  lastSnapshotAt: Date | null
}

export async function loadIntelligenceDigest(
  orgId: string,
  opts: { topN?: number } = {},
): Promise<IntelligenceDigest> {
  const topN = opts.topN ?? 5

  const openRecs = await platformDb
    .select({
      id: executiveRecommendations.id,
      title: executiveRecommendations.title,
      narrative: executiveRecommendations.narrative,
      rankScore: executiveRecommendations.rankScore,
      rankBucket: executiveRecommendations.rankBucket,
      kind: executiveRecommendations.kind,
    })
    .from(executiveRecommendations)
    .where(
      and(
        eq(executiveRecommendations.orgId, orgId),
        eq(executiveRecommendations.status, 'open'),
      ),
    )
    .orderBy(desc(executiveRecommendations.rankScore))
    .limit(100)

  const topPriorities: TopPriority[] = openRecs.slice(0, topN)

  const activeRiskCount = openRecs.filter((r) => r.kind === 'risk').length
  const activeOpportunityCount = openRecs.filter((r) => r.kind === 'opportunity').length

  // Compare latest snapshot vs the one before it for drift.
  const snapshots = await platformDb
    .select({
      id: executivePrioritySnapshots.id,
      snapshotAt: executivePrioritySnapshots.snapshotAt,
      topRanked: executivePrioritySnapshots.topRanked,
    })
    .from(executivePrioritySnapshots)
    .where(eq(executivePrioritySnapshots.orgId, orgId))
    .orderBy(desc(executivePrioritySnapshots.snapshotAt))
    .limit(2)

  const currentIds = new Set(topPriorities.map((p) => p.id))
  const previousTop = Array.isArray(snapshots[1]?.topRanked)
    ? (snapshots[1]!.topRanked as Array<{
        recommendationId: string
        title: string
        rankScore: number
      }>)
    : []
  const previousIds = new Set(previousTop.map((p) => p.recommendationId))

  const newTop = topPriorities.filter((p) => !previousIds.has(p.id))
  const droppedFromTop = previousTop
    .filter((p) => !currentIds.has(p.recommendationId))
    .map((p) => ({
      id: p.recommendationId,
      title: p.title,
      previousScore: p.rankScore,
    }))

  // "One thing to ignore": the lowest-score backlog/this_month rec marked as
  // mark_wrong, OR the oldest backlog rec that has never been acted on.
  const quiet = openRecs
    .filter((r) => r.rankBucket === 'backlog' || r.rankBucket === 'this_month')
    .sort((a, b) => a.rankScore - b.rankScore)[0] ?? null

  return {
    topPriorities,
    diff: {
      newTop,
      droppedFromTop,
      oneToIgnore: quiet,
    },
    activeRiskCount,
    activeOpportunityCount,
    lastSnapshotAt: snapshots[0]?.snapshotAt ?? null,
  }
}
