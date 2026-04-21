/**
 * Recommendation memory writer for ExecutiveOS learning loop.
 *
 * Persists ranked cross-domain findings into `executive_recommendations`
 * using a deterministic `dedupe_key`, so the same signal across runs
 * updates a single row (last_seen_at + rank drift tracking).
 *
 * Also snapshots the top-N ranked recommendations per run for trend
 * analysis ("was top-5 last week, now backlog — why?").
 */
import { eq, and, desc, sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  executiveRecommendations,
  executiveRecommendationFeedback,
  executivePrioritySnapshots,
} from '@nzila/db/schema'
import type { RankedFinding } from '@nzila/executive-os'

export interface PersistRecommendationsOpts {
  orgId: string
  sourceAgent: string
  sourceRunId?: string
  findings: ReadonlyArray<RankedFinding>
}

export interface PersistedRecommendation {
  recommendationId: string
  dedupeKey: string
  rankScore: number
  rankBucket: string
  title: string
  isNew: boolean
}

/**
 * Upsert each finding into executive_recommendations keyed on (orgId, dedupeKey=finding.id).
 * Existing rows are refreshed (rank/bucket/narrative/last_seen_at) so we capture drift.
 */
export async function persistRankedFindings(
  opts: PersistRecommendationsOpts,
): Promise<PersistedRecommendation[]> {
  const { orgId, sourceAgent, sourceRunId, findings } = opts
  const persisted: PersistedRecommendation[] = []

  for (const f of findings) {
    const dedupeKey = f.id
    const [existing] = await platformDb
      .select({ id: executiveRecommendations.id })
      .from(executiveRecommendations)
      .where(
        and(
          eq(executiveRecommendations.orgId, orgId),
          eq(executiveRecommendations.dedupeKey, dedupeKey),
        ),
      )
      .limit(1)

    if (existing) {
      await platformDb
        .update(executiveRecommendations)
        .set({
          sourceRunId: sourceRunId ?? null,
          kind: f.kind,
          domains: f.domains,
          title: f.title,
          narrative: f.narrative,
          rankScore: f.rank.score,
          rankBucket: f.rank.bucket,
          rankExplanation: f.rank.explanation,
          confidence: f.confidence,
          reversibility: f.reversibility,
          evidence: f.evidence,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
          // If rec was closed but signal re-fired, reopen it.
          status: sql`CASE WHEN ${executiveRecommendations.status} = 'closed' THEN 'open' ELSE ${executiveRecommendations.status} END`,
        })
        .where(eq(executiveRecommendations.id, existing.id))

      persisted.push({
        recommendationId: existing.id,
        dedupeKey,
        rankScore: f.rank.score,
        rankBucket: f.rank.bucket,
        title: f.title,
        isNew: false,
      })
    } else {
      const [row] = await platformDb
        .insert(executiveRecommendations)
        .values({
          orgId,
          dedupeKey,
          sourceAgent,
          sourceRunId: sourceRunId ?? null,
          kind: f.kind,
          domains: f.domains,
          title: f.title,
          narrative: f.narrative,
          rankScore: f.rank.score,
          rankBucket: f.rank.bucket,
          rankExplanation: f.rank.explanation,
          confidence: f.confidence,
          reversibility: f.reversibility,
          evidence: f.evidence,
        })
        .returning({ id: executiveRecommendations.id })

      if (row) {
        persisted.push({
          recommendationId: row.id,
          dedupeKey,
          rankScore: f.rank.score,
          rankBucket: f.rank.bucket,
          title: f.title,
          isNew: true,
        })
      }
    }
  }

  return persisted
}

export interface SnapshotOpts {
  orgId: string
  topN?: number
  extraMetrics?: Record<string, unknown>
}

/**
 * Writes a priority snapshot row capturing the top-N open recommendations
 * (by rank_score desc). Call after a synthesis run or on a daily cron.
 */
export async function takePrioritySnapshot(opts: SnapshotOpts): Promise<string | null> {
  const { orgId, topN = 10, extraMetrics = {} } = opts

  const top = await platformDb
    .select({
      id: executiveRecommendations.id,
      title: executiveRecommendations.title,
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
    .limit(topN)

  const activeRisks = top.filter((r) => r.kind === 'risk').length
  const activeOpps = top.filter((r) => r.kind === 'opportunity').length

  const [row] = await platformDb
    .insert(executivePrioritySnapshots)
    .values({
      orgId,
      topRanked: top.map((r) => ({
        recommendationId: r.id,
        title: r.title,
        rankScore: r.rankScore,
        rankBucket: r.rankBucket,
        kind: r.kind,
      })),
      metrics: {
        activeRisks,
        activeOpps,
        topCount: top.length,
        ...extraMetrics,
      },
    })
    .returning({ id: executivePrioritySnapshots.id })

  return row?.id ?? null
}

export interface FeedbackOpts {
  recommendationId: string
  actorId: string
  verdict: 'accept' | 'reject' | 'postpone' | 'modify' | 'mark_wrong' | 'mark_high_impact'
  note?: string
}

export async function recordRecommendationFeedback(opts: FeedbackOpts): Promise<string | null> {
  const [row] = await platformDb
    .insert(executiveRecommendationFeedback)
    .values({
      recommendationId: opts.recommendationId,
      actorId: opts.actorId,
      verdict: opts.verdict,
      note: opts.note ?? null,
    })
    .returning({ id: executiveRecommendationFeedback.id })

  // Side-effect: update rec lifecycle on terminal verdicts.
  const terminal: Record<string, string | null> = {
    accept: 'accepted',
    reject: 'rejected',
    postpone: 'postponed',
    mark_wrong: 'closed',
    mark_high_impact: null, // keep open
    modify: null,
  }
  const newStatus = terminal[opts.verdict]
  if (newStatus) {
    await platformDb
      .update(executiveRecommendations)
      .set({
        status: newStatus,
        closedAt: newStatus === 'closed' || newStatus === 'rejected' || newStatus === 'accepted'
          ? new Date()
          : null,
        updatedAt: new Date(),
      })
      .where(eq(executiveRecommendations.id, opts.recommendationId))
  }

  return row?.id ?? null
}

/**
 * Convenience: record feedback by looking up the recommendation via
 * (orgId, dedupeKey). The /intelligence pages render live ranked findings
 * whose ids ARE the dedupe keys, so UI never has to know the row uuid.
 * Returns null if no open recommendation matches — safe no-op.
 */
export async function recordRecommendationFeedbackByDedupeKey(opts: {
  orgId: string
  dedupeKey: string
  actorId: string
  verdict: FeedbackOpts['verdict']
  note?: string
}): Promise<string | null> {
  const [rec] = await platformDb
    .select({ id: executiveRecommendations.id })
    .from(executiveRecommendations)
    .where(
      and(
        eq(executiveRecommendations.orgId, opts.orgId),
        eq(executiveRecommendations.dedupeKey, opts.dedupeKey),
      ),
    )
    .limit(1)
  if (!rec) return null
  return recordRecommendationFeedback({
    recommendationId: rec.id,
    actorId: opts.actorId,
    verdict: opts.verdict,
    note: opts.note,
  })
}

/**
 * List open, ranked recommendations for an org.
 * Cheap — served by (org_id, status, rank_score) index.
 */
export async function listOpenRecommendations(
  orgId: string,
  opts: { kind?: 'risk' | 'opportunity'; limit?: number } = {},
) {
  const { kind, limit = 50 } = opts
  const conditions = [
    eq(executiveRecommendations.orgId, orgId),
    eq(executiveRecommendations.status, 'open'),
  ]
  if (kind) conditions.push(eq(executiveRecommendations.kind, kind))

  return platformDb
    .select()
    .from(executiveRecommendations)
    .where(and(...conditions))
    .orderBy(desc(executiveRecommendations.rankScore))
    .limit(limit)
}
