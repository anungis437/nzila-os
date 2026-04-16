import { withApi, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { insightRecommendations } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { withRLSContext } from '@/lib/db/with-rls-context';

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
      avgRating: Number(r.avg_rating),
    }));

    const recommendations = [
      ...(topFrictionPoints.length > 0
        ? [`Prioritize UX fixes for ${topFrictionPoints[0].category} flow in next sprint.`]
        : ['No critical friction spikes detected; continue current rollout cadence.']),
      'Promote guided onboarding for first-session users to improve activation.',
      'Review org-level case SLA trend and escalate high-risk queues proactively.',
    ];

    const [insight] = await db
      .insert(insightRecommendations)
      .values({
        organizationId,
        insightType: 'optimization',
        category: 'operations',
        priority: topFrictionPoints.length > 0 ? 'high' : 'medium',
        title: 'Weekly Engagement and Friction Summary',
        description: 'Automated weekly synthesis of adoption, usage intensity, and feedback friction points.',
        dataSource: {
          source: 'pilot_events + pilot_feedback',
          window: '7d',
        },
        metrics: {
          totalEvents: Number(eventRollup?.total_events ?? 0),
          sessionsStarted: Number(eventRollup?.sessions_started ?? 0),
          casesCreated: Number(eventRollup?.cases_created ?? 0),
          documentsUploaded: Number(eventRollup?.documents_uploaded ?? 0),
          activeUsers: Number(eventRollup?.active_users ?? 0),
          engagementScore,
        },
        recommendations,
        confidenceScore: '0.83',
        relatedEntities: {
          topFrictionPoints,
        },
        actionRequired: topFrictionPoints.length > 0,
        estimatedBenefit: 'Improved activation and reduced support burden through targeted UX remediation.',
      })
      .returning();

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.MEDIUM,
      userId: userId ?? undefined,
      organizationId,
      resource: 'insight_recommendations',
      resourceId: insight.id,
      action: 'weekly_insight_generated',
      details: {
        engagementScore,
        topFrictionPoints,
      },
    });

    return {
      window: '7d',
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
