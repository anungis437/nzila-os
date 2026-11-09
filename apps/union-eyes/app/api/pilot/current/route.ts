/**
 * GET /api/pilot/current
 *
 * Returns evidence-backed pilot metrics for the authenticated user's organization. Reads run in the caller's RLS tenant context. Where
 * no trustworthy activity event exists, the response says not measured instead of using membership-row edits or stored fallback values.
 */

import { NextResponse } from "next/server";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { directRoleIn, isOfficerOrAboveRole, resolveOrganizationAccess } from "@/lib/organizations/read-authority";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";
import { pilotEnrollments } from "@/db/schema/domains/pilot/pilot-enrollments";
import { pilotMilestones } from "@/db/schema/domains/pilot/pilot-milestones";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { PILOT_MEASUREMENT_WINDOW_DAYS, pilotActivityFigures, pilotCaseFigures, pilotCaseStatsColumns, pilotCaseStatsWindow } from "@/lib/pilot/pilot-measurements";
import type { PilotMetrics, PilotMilestone } from "@/types/marketing";

export const dynamic = "force-dynamic";

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId, userId } = context;

  try {
    // The officer role is checked in the exact organization whose figures are read, through the caller's own live membership there
    // (issue #1116), not in whichever organization a role resolver picks for the user. Hierarchy and platform titles confer nothing.
    const access = userId ? await resolveOrganizationAccess(userId) : null;
    if (!access || !isOfficerOrAboveRole(directRoleIn(access, organizationId))) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    return withRLSContext({ organizationId, userId }, async (tx) => {
      // Fetch enrollment
      const enrollments = await tx
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
      const milestoneRows = await tx
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

      const caseStats = await tx.execute(sql`
        SELECT ${pilotCaseStatsColumns()}
        FROM grievances
        WHERE organization_id = ${organizationId}::uuid
          AND ${pilotCaseStatsWindow()}
      `);
      const activityStats = await tx.execute(sql`
        WITH eligible AS (
          SELECT user_id, role,
                 role IN ('steward','chief_steward','officer','president','vice_president','secretary_treasurer','admin') AS organizer
            FROM organization_members
           WHERE organization_id = ${organizationId}::uuid
             AND status = 'active'
             AND deleted_at IS NULL
        ), active AS (
          SELECT DISTINCT pe.user_id
            FROM pilot_events pe
            JOIN eligible e ON e.user_id = pe.user_id
           WHERE pe.organization_id = ${organizationId}::uuid
             AND pe.created_at > NOW() - (${PILOT_MEASUREMENT_WINDOW_DAYS} * INTERVAL '1 day')
             AND pe.session_id LIKE 'server:%'
             AND pe.event_type IN ('case_created','case_imported','case_transitioned','case_closed','document_attached','document_uploaded','feedback_submitted')
        )
        SELECT
          COUNT(*) FILTER (WHERE e.organizer)::int AS organizer_denominator,
          COUNT(*) FILTER (WHERE e.organizer AND a.user_id IS NOT NULL)::int AS organizer_numerator,
          COUNT(*)::int AS member_denominator,
          COUNT(*) FILTER (WHERE a.user_id IS NOT NULL)::int AS member_numerator
          FROM eligible e
          LEFT JOIN active a ON a.user_id = e.user_id
      `);
      const figures = pilotCaseFigures(
        Array.from(caseStats)[0] as Record<string, unknown> | undefined,
        pilotActivityFigures(Array.from(activityStats)[0] as Record<string, unknown> | undefined),
      );

      const metrics: PilotMetrics = {
        id: enrollment.id,
        pilotId: enrollment.pilotId,
        organizationId: enrollment.organizationId,
        enrollmentDate: enrolledAt,
        daysActive,
        organizerAdoptionRate: figures.organizerAdoptionRate,
        memberEngagementRate: figures.memberEngagementRate,
        casesManaged: figures.casesManaged,
        avgTimeToResolution: figures.avgTimeToResolution,
        healthScore: enrollment.healthScore,
        milestones,
        lastCalculated: new Date(),
        measurement: figures.measurement,
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
