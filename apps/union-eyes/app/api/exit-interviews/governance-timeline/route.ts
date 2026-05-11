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

import { withApi } from '@/lib/api/framework';
import { and, eq, gte, desc } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

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

    const [events, recentInterviews] = await Promise.all([
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
        .where(
          and(
            eq(exitInterviewEvents.organizationId, orgId),
            gte(exitInterviewEvents.createdAt, since),
          ),
        )
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
            eq(exitInterviews.organizationId, orgId),
            gte(exitInterviews.createdAt, since),
          ),
        )
        .orderBy(desc(exitInterviews.createdAt)),
    ]);

    // Compute drift indicators from event patterns
    const eventTypeCounts: Record<string, number> = {};
    for (const event of events) {
      eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
    }

    // Stale reviews: submitted but not reviewed in >14 days
    const now = new Date();
    const staleReviews = recentInterviews.filter((i) => {
      if (i.status !== 'submitted') return false;
      const daysSinceCreated = (now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 14;
    });

    // Governance update rate (per 30 days)
    const govUpdatesLast30 = events.filter((e) => {
      const age = now.getTime() - e.createdAt.getTime();
      return age < 30 * 24 * 60 * 60 * 1000 && e.eventType === 'governance_updated';
    }).length;

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
