/**
 * GET /api/pilot/current
 *
 * Returns the current pilot program metrics for the authenticated
 * user's organization. Aggregates data from pilot_enrollments,
 * pilot_milestones, organization_members, and grievances tables.
 */

import { NextResponse } from "next/server";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";
import { db } from "@/db/db";
import { pilotEnrollments } from "@/db/schema/domains/pilot/pilot-enrollments";
import { pilotMilestones } from "@/db/schema/domains/pilot/pilot-milestones";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withSystemContext } from "@/lib/db/with-rls-context";
import type { PilotMetrics, PilotMilestone } from "@/types/marketing";

export const dynamic = "force-dynamic";

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    return withSystemContext(async () => {
      // Fetch enrollment
      const enrollments = await db
        .select()
        .from(pilotEnrollments)
        .where(eq(pilotEnrollments.organizationId, organizationId))
        .limit(1);

      const enrollment = enrollments[0];
      if (!enrollment || enrollment.status !== "active") {
        return NextResponse.json({ metrics: null });
      }

      // Calculate days active
      const enrolledAt = new Date(enrollment.enrolledAt);
      const daysActive = Math.max(
        1,
        Math.floor(
          (Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Fetch milestones
      const milestoneRows = await db
        .select()
        .from(pilotMilestones)
        .where(eq(pilotMilestones.organizationId, organizationId));

      const milestones: PilotMilestone[] = milestoneRows.map((m) => ({
        name: m.name,
        description: m.description,
        status: m.status as PilotMilestone["status"],
        targetDate: m.targetDate ?? undefined,
        completedAt: m.completedAt ?? undefined,
      }));

      // Live metrics from organization_members
      const memberStats = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE role IN ('organizer', 'steward', 'president', 'vp', 'officer'))
            AS organizer_count,
          COUNT(*) FILTER (WHERE role IN ('organizer', 'steward', 'president', 'vp', 'officer')
            AND updated_at > NOW() - INTERVAL '30 days')
            AS active_organizer_count,
          COUNT(*) AS total_members,
          COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days')
            AS active_members
        FROM organization_members
        WHERE organization_id = ${organizationId}
          AND deleted_at IS NULL
      `);

      const mStats = Array.from(memberStats)[0] as Record<string, unknown> | undefined;
      const organizerCount = Number(mStats?.organizer_count ?? 0);
      const activeOrganizerCount = Number(mStats?.active_organizer_count ?? 0);
      const totalMembers = Number(mStats?.total_members ?? 0);
      const activeMembers = Number(mStats?.active_members ?? 0);

      const organizerAdoptionRate =
        organizerCount > 0
          ? Math.round((activeOrganizerCount / organizerCount) * 100)
          : enrollment.organizerAdoptionRate;

      const memberEngagementRate =
        totalMembers > 0
          ? Math.round((activeMembers / totalMembers) * 100)
          : enrollment.memberEngagementRate;

      // Live metrics from grievances
      const caseStats = await db.execute(sql`
        SELECT
          COUNT(*) AS cases_managed,
          AVG(
            EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600
          ) AS avg_resolution_hours
        FROM grievances
        WHERE organization_id = ${organizationId}::uuid
          AND created_at > NOW() - INTERVAL '30 days'
      `);

      const cStats = Array.from(caseStats)[0] as Record<string, unknown> | undefined;
      const casesManaged = Number(cStats?.cases_managed ?? enrollment.casesManaged);
      const avgTimeToResolution = Math.round(
        Number(cStats?.avg_resolution_hours ?? enrollment.avgTimeToResolution)
      );

      const metrics: PilotMetrics = {
        id: enrollment.id,
        pilotId: enrollment.pilotId,
        organizationId: enrollment.organizationId,
        enrollmentDate: enrolledAt,
        daysActive,
        organizerAdoptionRate,
        memberEngagementRate,
        casesManaged,
        avgTimeToResolution,
        healthScore: enrollment.healthScore,
        milestones,
        lastCalculated: new Date(),
      };

      return NextResponse.json({ metrics });
    });
  } catch (error) {
    const { logger: log } = await import('@/lib/logger');
    log.error('Pilot current metrics query failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to load pilot metrics"
    );
  }
});
