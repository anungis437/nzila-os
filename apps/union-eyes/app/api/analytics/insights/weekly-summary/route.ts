import { withApi, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { insightRecommendations } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    rateLimit: RATE_LIMITS.ADVANCED_ANALYTICS,
    openapi: {
      tags: ['Analytics'],
      summary: 'Generate weekly event-derived engagement and friction insights',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [eventRollup] = await withRLSContext(async () => db.execute(sql`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE event_type = 'session_started')::int AS sessions_started,
        COUNT(*) FILTER (WHERE event_type = 'case_created')::int AS cases_created,
        COUNT(*) FILTER (WHERE event_type = 'document_uploaded')::int AS documents_uploaded,
        COUNT(DISTINCT user_id)::int AS active_users
      FROM pilot_events
      WHERE organization_id = ${organizationId}::uuid
        AND created_at >= NOW() - INTERVAL '7 days'
    `)) as Array<{
      total_events: number;
      sessions_started: number;
      cases_created: number;
      documents_uploaded: number;
      active_users: number;
    }>;

    const frictionRows = await withRLSContext(async () => db.execute(sql`
      SELECT
        COALESCE(category, 'uncategorized') AS category,
        COUNT(*)::int AS cnt,
        ROUND(AVG(ease_rating)::numeric, 2)::text AS avg_rating
      FROM pilot_feedback
      WHERE organization_id = ${organizationId}::uuid
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY COALESCE(category, 'uncategorized')
      ORDER BY cnt DESC
      LIMIT 3
    `)) as Array<{ category: string; cnt: number; avg_rating: string }>;

    const engagementScore = eventRollup?.active_users && eventRollup?.sessions_started
      ? Number(((eventRollup.active_users / Math.max(eventRollup.sessions_started, 1)) * 100).toFixed(2))
      : 0;

    const topFrictionPoints = frictionRows.map((r) => ({
      category: r.category,
      count: Number(r.cnt),
      avgRating: r.avg_rating === null ? null : Number(r.avg_rating), // Unknown is not zero.
    }));

    // Deterministic database rollup: no model call, AI confidence or verified impact.
    const recommendations = topFrictionPoints.length > 0
      ? [`Review the ${topFrictionPoints[0].category} feedback category (${topFrictionPoints[0].count} reports) before deciding on corrective action.`]
      : ['No feedback was recorded in the last seven days; friction cannot be assessed.'];

    const insight = await withRLSContext({ organizationId }, async (tx) => {
      const [created] = await tx
        .insert(insightRecommendations)
        .values({
          organizationId,
          insightType: 'optimization',
          category: 'operations',
          priority: 'low', // Human triage must establish urgency.
          title: 'Weekly Engagement and Friction Summary',
          description: 'Deterministic seven-day counts from pilot events and feedback. No model, impact estimate, or risk assessment was performed.',
          aiReferenceId: null,
          dataSource: {
            source: 'pilot_events + pilot_feedback',
            window: '7d',
            method: 'deterministic_aggregation',
            aiUsed: false,
          },
          metrics: {
            totalEvents: Number(eventRollup?.total_events ?? 0),
            sessionsStarted: Number(eventRollup?.sessions_started ?? 0),
            // A count of telemetry events, not of cases: the case table is not read here.
            caseCreatedEvents: Number(eventRollup?.cases_created ?? 0),
            documentsUploaded: Number(eventRollup?.documents_uploaded ?? 0),
            activeUsers: Number(eventRollup?.active_users ?? 0),
            engagementScore,
          },
          recommendations,
          confidenceScore: null,
          relatedEntities: {
            topFrictionPoints,
          },
          actionRequired: false, // No action assigned without human triage.
          estimatedBenefit: null,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId ?? null,
        action: 'insight.weekly_summary.generate',
        resourceType: 'insight_recommendations',
        resourceId: created.id,
        details: {
          engagementScore,
          topFrictionPoints,
          generationMethod: 'deterministic_aggregation',
          aiUsed: false,
        },
      });
      return created;
    });
    return {
      window: '7d',
      generationMethod: 'deterministic_aggregation',
      aiUsed: false,
      confidenceScore: null,
      engagement: {
        totalEvents: Number(eventRollup?.total_events ?? 0),
        activeUsers: Number(eventRollup?.active_users ?? 0),
        sessionsStarted: Number(eventRollup?.sessions_started ?? 0),
        engagementScore,
      },
      topFrictionPoints,
      recommendations,
      insightId: insight.id,
    };
  },
);
