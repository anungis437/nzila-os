/**
 * GET /api/pilot/overview
 *
 * Returns pilot metrics for the enrolled organizations, one bounded page at a time.
 * Reachable only by a platform administrator: the platform-staff authority (isPlatformAdminUser) is the mandate for a read across
 * organizations. Holding an officer role title in the platform organization is not, and neither is any organization-level role.
 * Each read is audited, with the page it returned.
 */

import { NextResponse } from "next/server";
import { requireUser, hasMinRole, isPlatformAdminUser } from "@/lib/api-auth-guard";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";
import { db } from "@/db/db";
import { pilotEnrollments } from "@/db/schema/domains/pilot/pilot-enrollments";
import { pilotMilestones } from "@/db/schema/domains/pilot/pilot-milestones";
import { organizations } from "@/db/schema-organizations";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { operationAuditResponse, performAtomicAuditedOperation } from "@/lib/audit/operation-audit";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import type { PilotMilestone } from "@/types/marketing";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const boundedInteger = (raw: string | null, fallback: number, min: number, max: number): number => {
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
};

type MemberStats = { organization_id: string; organizer_count: unknown; active_organizer_count: unknown; total_members: unknown; active_members: unknown };
type CaseStats = { organization_id: string; cases_managed: unknown; avg_resolution_hours: unknown };

export async function GET(request?: Request) {
  try {
    const user = await requireUser();

    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    if (!(await isPlatformAdminUser(user.userId))) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Only platform administrators can view the pilot overview"
      );
    }

    const params = request ? new URL(request.url).searchParams : new URLSearchParams();
    const limit = boundedInteger(params.get("limit"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const offset = boundedInteger(params.get("offset"), 0, 0, 1_000_000);

    const page = await performAtomicAuditedOperation(
      {
        scope: "system",
        organizationId: user.organizationId ?? DEFAULT_ORGANIZATION_ID,
        userId: user.userId,
        action: "pilot.overview.read",
        resourceType: "pilot_enrollments",
        details: { limit, offset },
      },
      async () => {
      const [{ total }] = (await db
        .select({ total: sql<number>`count(*)` })
        .from(pilotEnrollments)
        .where(eq(pilotEnrollments.status, "active"))) as Array<{ total: number | string }>;

      const enrollments = await db
        .select({
          enrollment: pilotEnrollments,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(pilotEnrollments)
        .innerJoin(organizations, eq(pilotEnrollments.organizationId, organizations.id))
        .where(eq(pilotEnrollments.status, "active"))
        .orderBy(asc(pilotEnrollments.enrolledAt), asc(pilotEnrollments.id))
        .limit(limit)
        .offset(offset);

      const orgIds = enrollments.map(({ enrollment }) => enrollment.organizationId);
      const idList = sql.join(orgIds.map((id) => sql`${id}::uuid`), sql`, `);

      // One query per figure for the whole page, not three per organization.
      const milestoneRows = orgIds.length
        ? await db.select().from(pilotMilestones).where(inArray(pilotMilestones.organizationId, orgIds))
        : [];
      const memberStatRows = orgIds.length
        ? Array.from(
            await db.execute(sql`
              SELECT
                organization_id::text AS organization_id,
                COUNT(*) FILTER (WHERE role IN ('organizer', 'steward', 'president', 'vp', 'officer'))
                  AS organizer_count,
                COUNT(*) FILTER (WHERE role IN ('organizer', 'steward', 'president', 'vp', 'officer')
                  AND updated_at > NOW() - INTERVAL '30 days')
                  AS active_organizer_count,
                COUNT(*) AS total_members,
                COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days')
                  AS active_members
              FROM organization_members
              WHERE organization_id IN (${idList})
                AND deleted_at IS NULL
              GROUP BY organization_id
            `),
          ) as unknown as MemberStats[]
        : [];
      const caseStatRows = orgIds.length
        ? Array.from(
            await db.execute(sql`
              SELECT
                organization_id::text AS organization_id,
                COUNT(*) AS cases_managed,
                AVG(
                  EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600
                ) AS avg_resolution_hours
              FROM grievances
              WHERE organization_id IN (${idList})
                AND created_at > NOW() - INTERVAL '30 days'
              GROUP BY organization_id
            `),
          ) as unknown as CaseStats[]
        : [];
      const memberStatsByOrg = new Map(memberStatRows.map((row) => [String(row.organization_id), row]));
      const caseStatsByOrg = new Map(caseStatRows.map((row) => [String(row.organization_id), row]));

      const orgMetrics = enrollments.map(({ enrollment, orgName, orgSlug }) => {
          const orgId = enrollment.organizationId;

          const milestones: PilotMilestone[] = milestoneRows
            .filter((m) => m.organizationId === orgId)
            .map((m) => ({
              name: m.name,
              description: m.description,
              status: m.status as PilotMilestone["status"],
              targetDate: m.targetDate ?? undefined,
              completedAt: m.completedAt ?? undefined,
            }));

          const mStats = memberStatsByOrg.get(orgId);
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
          const cStats = caseStatsByOrg.get(orgId);
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
        });

      return { organizations: orgMetrics, pagination: { limit, offset, total: Number(total), returned: orgMetrics.length } };
      },
    );

    return NextResponse.json(page);
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    const { logger: log } = await import('@/lib/logger');
    log.error('Pilot overview query failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to load pilot overview"
    );
  }
}
