/**
 * GET /api/pilot/overview
 *
 * Returns pilot metrics only for organizations in which the caller is a direct
 * active administrator. Platform title alone never authorizes cross-tenant metrics.
 */

import { NextResponse } from "next/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";
import { db } from "@/db/db";
import { pilotEnrollments } from "@/db/schema/domains/pilot/pilot-enrollments";
import { pilotMilestones } from "@/db/schema/domains/pilot/pilot-milestones";
import { organizations } from "@/db/schema-organizations";
import { eq, inArray, and, sql } from "drizzle-orm";
import { withSystemContext } from "@/lib/db/with-rls-context";
import { resolveOrganizationAccess, isAdministrativeRole } from "@/lib/organizations/read-authority";
import type { PilotMilestone } from "@/types/marketing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    // No standing platform-owner exception. A verified, purpose-bound cross-
    // tenant institutional mandate must be implemented separately.
    const access = await resolveOrganizationAccess(user.userId);
    const permittedOrgIds = [...access.direct.entries()]
      .filter(([, role]) => isAdministrativeRole(role))
      .map(([id]) => id);
    if (permittedOrgIds.length === 0) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Direct organization administrator mandate required");
    }

    return await withSystemContext(async () => {
      // Fetch all active enrollments with org names
      const enrollments = await db
        .select({
          enrollment: pilotEnrollments,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(pilotEnrollments)
        .innerJoin(organizations, eq(pilotEnrollments.organizationId, organizations.id))
        .where(and(
          eq(pilotEnrollments.status, "active"),
          inArray(pilotEnrollments.organizationId, permittedOrgIds),
        )).limit(100);

      // Defensive row filtering also protects against misconfigured or mocked
      // system-role data adapters that fail to apply the SQL predicate.
      const scopedEnrollments = enrollments.filter(({ enrollment }) =>
        permittedOrgIds.includes(enrollment.organizationId));

      const orgMetrics = await Promise.all(
        scopedEnrollments.map(async ({ enrollment, orgName, orgSlug }) => {
          const orgId = enrollment.organizationId;

          // Fetch milestones
          const milestoneRows = await db
            .select()
            .from(pilotMilestones)
            .where(eq(pilotMilestones.organizationId, orgId));

          const milestones: PilotMilestone[] = milestoneRows.map((m) => ({
            name: m.name,
            description: m.description,
            status: m.status as PilotMilestone["status"],
            targetDate: m.targetDate ?? undefined,
            completedAt: m.completedAt ?? undefined,
          }));

          // Member stats
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
            WHERE organization_id = ${orgId}
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

          // Grievance stats
          const caseStats = await db.execute(sql`
            SELECT
              COUNT(*) AS cases_managed,
              AVG(
                EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600
              ) AS avg_resolution_hours
            FROM grievances
            WHERE organization_id = ${orgId}::uuid
              AND created_at > NOW() - INTERVAL '30 days'
          `);

          const cStats = Array.from(caseStats)[0] as Record<string, unknown> | undefined;
          const casesManaged = Number(cStats?.cases_managed ?? enrollment.casesManaged);
          const avgTimeToResolution = Math.round(
            Number(cStats?.avg_resolution_hours ?? enrollment.avgTimeToResolution)
          );

          const enrolledAt = new Date(enrollment.enrolledAt);
          const daysActive = Math.max(
            1,
            Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24))
          );

          return {
            id: enrollment.id,
            pilotId: enrollment.pilotId,
            organizationId: orgId,
            organizationName: orgName,
            organizationSlug: orgSlug,
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
        })
      );

      return NextResponse.json({ organizations: orgMetrics });
    });
  } catch (error) {
    const { logger: log } = await import('@/lib/logger');
    log.error('Pilot overview query failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to load pilot overview"
    );
  }
}
