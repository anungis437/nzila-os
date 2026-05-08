// cognition-governance-ci: allow-route-bypass — Bespoke DB time-series aggregation; not a single-engine cognition surface.
/**
 * GET /api/exit-interviews/governance-timeline
 *
 * Returns a time-series view of governance activity and continuity drift
 * for the organization.
 *
 * Tracks over time:
 *   - New exit interview captures
 *   - Published interviews
 *   - Governance update events
 *   - Average continuity risk trajectory
 *   - Consent coverage rate
 *
 * This is ORGANIZATIONAL CONTINUITY OBSERVABILITY.
 * It does NOT track or evaluate individual employees.
 *
 * Access: officer+
 */

import { withApi } from '@/lib/api/framework';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

export interface GovernanceTimelineEntry {
  month: string; // YYYY-MM
  newInterviewCount: number;
  publishedCount: number;
  governanceUpdateCount: number;
  averageRiskScore: number | null;
  consentCoverageRate: number; // 0–100
}

export interface GovernanceDriftReport {
  organizationId: string;
  generatedAt: string;
  timeline: GovernanceTimelineEntry[];
  currentExposureScore: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  totalInterviewsCaptured: number;
  totalPublished: number;
  governanceActivityLast30Days: number;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get governance drift timeline',
      description:
        'Time-series view of continuity governance activity and knowledge capture velocity.',
    },
  },
  async ({ organizationId }) => {
    const orgId = organizationId!;

    // Look back 12 months
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const sinceIso = since.toISOString();

    // Fetch interviews in range
    const interviews = await db
      .select({
        id: exitInterviews.id,
        status: exitInterviews.status,
        createdAt: exitInterviews.createdAt,
        publishedAt: exitInterviews.publishedAt,
        continuityRiskScore: exitInterviews.continuityRiskScore,
        consentGranted: exitInterviews.consentGranted,
      })
      .from(exitInterviews)
      .where(
        and(
          eq(exitInterviews.organizationId, orgId),
          gte(exitInterviews.createdAt, new Date(sinceIso)),
        ),
      );

    // Fetch governance events in range
    const govEvents = await db
      .select({
        createdAt: exitInterviewEvents.createdAt,
        eventType: exitInterviewEvents.eventType,
      })
      .from(exitInterviewEvents)
      .where(
        and(
          eq(exitInterviewEvents.organizationId, orgId),
          gte(exitInterviewEvents.createdAt, new Date(sinceIso)),
        ),
      );

    // Build monthly buckets (last 12 months)
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    function toMonth(d: Date | null): string | null {
      if (!d) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const timeline: GovernanceTimelineEntry[] = months.map((month) => {
      const monthInterviews = interviews.filter((i) => toMonth(i.createdAt) === month);
      const monthPublished = interviews.filter((i) => toMonth(i.publishedAt) === month);
      const monthGovEvents = govEvents.filter(
        (e) => toMonth(e.createdAt) === month && e.eventType === 'governance_updated',
      );

      const riskScores = monthInterviews
        .map((i) => i.continuityRiskScore)
        .filter((s): s is number => s != null);

      const consentedCount = monthInterviews.filter((i) => i.consentGranted).length;

      return {
        month,
        newInterviewCount: monthInterviews.length,
        publishedCount: monthPublished.length,
        governanceUpdateCount: monthGovEvents.length,
        averageRiskScore:
          riskScores.length > 0
            ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
            : null,
        consentCoverageRate:
          monthInterviews.length > 0
            ? Math.round((consentedCount / monthInterviews.length) * 100)
            : 100,
      };
    });

    // Trend direction: compare last 3 months avg risk vs prior 3
    const recentRisk = timeline
      .slice(-3)
      .flatMap((m) => (m.averageRiskScore != null ? [m.averageRiskScore] : []));
    const priorRisk = timeline
      .slice(-6, -3)
      .flatMap((m) => (m.averageRiskScore != null ? [m.averageRiskScore] : []));

    let trendDirection: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentRisk.length > 0 && priorRisk.length > 0) {
      const recentAvg = recentRisk.reduce((a, b) => a + b, 0) / recentRisk.length;
      const priorAvg = priorRisk.reduce((a, b) => a + b, 0) / priorRisk.length;
      if (recentAvg < priorAvg - 5) trendDirection = 'improving';
      else if (recentAvg > priorAvg + 5) trendDirection = 'degrading';
    }

    const last30Days = govEvents.filter((e) => {
      const age = now.getTime() - e.createdAt.getTime();
      return age < 30 * 24 * 60 * 60 * 1000 && e.eventType === 'governance_updated';
    }).length;

    const allRiskScores = interviews
      .map((i) => i.continuityRiskScore)
      .filter((s): s is number => s != null);

    const currentExposureScore =
      allRiskScores.length > 0
        ? Math.round(allRiskScores.reduce((a, b) => a + b, 0) / allRiskScores.length)
        : 0;

    return {
      data: {
        organizationId: orgId,
        generatedAt: new Date().toISOString(),
        timeline,
        currentExposureScore,
        trendDirection,
        totalInterviewsCaptured: interviews.length,
        totalPublished: interviews.filter((i) => i.status === 'published').length,
        governanceActivityLast30Days: last30Days,
      } satisfies GovernanceDriftReport,
    };
  },
);
