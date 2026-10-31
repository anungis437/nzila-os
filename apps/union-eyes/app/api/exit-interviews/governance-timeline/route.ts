// cognition-governance-ci: allow-route-bypass — Bespoke DB time-series; not a single-engine cognition output.
/**
 * GET /api/exit-interviews/governance-timeline
 *
 * Returns detailed time-series governance event history and continuity drift
 * indicators for the organization.
 *
 * Provides event-level governance observability:
 *   - All governance update events with timestamps
 *   - Sensitivity classification changes over time
 *   - Review and publish velocity
 *   - Consent grant patterns
 *
 * Access: officer+
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { and, eq, gte, desc, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';
import { officerGovernanceCondition } from '@/lib/knowledge-transfer/governance/interview-access';

export const dynamic = 'force-dynamic';

// The interview window is read in full or refused: a silent cut would skew every count derived from it.
const MAX_INTERVIEWS_IN_WINDOW = 5000;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get governance event timeline',
      description:
        'Detailed governance event history for continuity drift analysis. Shows sensitivity changes, review activity, and publish patterns.',
    },
  },
  async ({ organizationId }) => {
    const orgId = organizationId!;

    // 6-month lookback for detailed event history
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    // The event scope is shared by the feed (newest 500) and the counts, which are computed over every event in the window
    // rather than over the feed.
    const eventScope = and(
      eq(exitInterviewEvents.organizationId, orgId),
      gte(exitInterviewEvents.createdAt, since),
      // Events of an interview above the officer floor (administrator-only levels) are not part of this view.
      inArray(
        exitInterviewEvents.interviewId,
        db.select({ id: exitInterviews.id }).from(exitInterviews).where(officerGovernanceCondition(orgId)),
      ),
    );
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [events, recentInterviews, typeCountRows, [governanceLast30Row]] = await Promise.all([
      db
        .select({
          id: exitInterviewEvents.id,
          interviewId: exitInterviewEvents.interviewId,
          eventType: exitInterviewEvents.eventType,
          notes: exitInterviewEvents.notes,
          payload: exitInterviewEvents.payload,
          actorUserId: exitInterviewEvents.actorUserId,
          createdAt: exitInterviewEvents.createdAt,
        })
        .from(exitInterviewEvents)
        .where(eventScope)
        .orderBy(desc(exitInterviewEvents.createdAt))
        .limit(500),

      db
        .select({
          id: exitInterviews.id,
          title: exitInterviews.title,
          status: exitInterviews.status,
          sensitivityLevel: exitInterviews.sensitivityLevel,
          consentGranted: exitInterviews.consentGranted,
          continuityRiskScore: exitInterviews.continuityRiskScore,
          indexingStatus: exitInterviews.indexingStatus,
          createdAt: exitInterviews.createdAt,
          publishedAt: exitInterviews.publishedAt,
          reviewedAt: exitInterviews.reviewedAt,
        })
        .from(exitInterviews)
        .where(
          and(
            officerGovernanceCondition(orgId),
            gte(exitInterviews.createdAt, since),
          ),
        )
        .orderBy(desc(exitInterviews.createdAt))
        .limit(MAX_INTERVIEWS_IN_WINDOW + 1),

      db
        .select({ eventType: exitInterviewEvents.eventType, total: sql<number>`count(*)::int` })
        .from(exitInterviewEvents)
        .where(eventScope)
        .groupBy(exitInterviewEvents.eventType),

      db
        .select({ total: sql<number>`count(*)::int` })
        .from(exitInterviewEvents)
        .where(and(eventScope, eq(exitInterviewEvents.eventType, 'governance_updated'), gte(exitInterviewEvents.createdAt, last30Days))),
    ]);

    if (recentInterviews.length > MAX_INTERVIEWS_IN_WINDOW) {
      throw ApiError.externalService('Governance timeline', 'Interview window exceeds safe limits; narrow the period');
    }

    // Compute drift indicators from event patterns
    const eventTypeCounts: Record<string, number> = {};
    for (const row of typeCountRows) eventTypeCounts[row.eventType] = row.total;

    // Stale reviews: submitted but not reviewed in >14 days
    const now = new Date();
    const staleReviews = recentInterviews.filter((i) => {
      if (i.status !== 'submitted') return false;
      const daysSinceCreated = (now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 14;
    });

    // Governance update rate (per 30 days)
    const govUpdatesLast30 = governanceLast30Row?.total ?? 0;

    // Sensitivity distribution
    const sensitivityDist: Record<string, number> = {};
    for (const i of recentInterviews) {
      sensitivityDist[i.sensitivityLevel] = (sensitivityDist[i.sensitivityLevel] ?? 0) + 1;
    }

    // Indexing coverage
    const indexingDist: Record<string, number> = {};
    for (const i of recentInterviews) {
      indexingDist[i.indexingStatus] = (indexingDist[i.indexingStatus] ?? 0) + 1;
    }

    // Recent governance events (for timeline feed)
    const timelineFeed = events
      .filter((e) =>
        ['governance_updated', 'published', 'reviewed', 'indexed', 'summarized'].includes(
          e.eventType,
        ),
      )
      .slice(0, 50)
      .map((e) => ({
        id: e.id,
        interviewId: e.interviewId,
        eventType: e.eventType,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
      }));

    return {
      data: {
        organizationId: orgId,
        generatedAt: now.toISOString(),
        timelineFeed,
        eventTypeCounts,
        staleReviewCount: staleReviews.length,
        staleReviewIds: staleReviews.map((i) => i.id),
        governanceUpdatesLast30Days: govUpdatesLast30,
        sensitivityDistribution: sensitivityDist,
        indexingDistribution: indexingDist,
        totalInterviewsInWindow: recentInterviews.length,
        publishedInWindow: recentInterviews.filter((i) => i.status === 'published').length,
      },
    };
  },
);
