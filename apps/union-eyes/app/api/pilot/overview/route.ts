/**
 * GET /api/pilot/overview
 *
 * Returns pilot metrics for the enrolled organizations the caller directly administers, one bounded page at a time.
 * The figures are tenant content (member counts, grievance volumes and resolution times), so a platform title is no mandate to read them
 * (#1116): there is no cross-tenant read here. Both the count and the page are scoped to the organizations where the caller holds a live,
 * direct administrative membership; a caller who administers none is refused, and one whose organizations are not enrolled gets an empty
 * page. Hierarchy (a parent's or federation's administrator) confers nothing. Each read is audited, with the page it returned.
 */

import { NextResponse } from "next/server";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { isAdministrativeRole, resolveOrganizationAccess } from "@/lib/organizations/read-authority";
import {
  ErrorCode,
  standardErrorResponse,
} from "@/lib/api/standardized-responses";
import { pilotEnrollments } from "@/db/schema/domains/pilot/pilot-enrollments";
import { pilotMilestones } from "@/db/schema/domains/pilot/pilot-milestones";
import { organizations } from "@/db/schema-organizations";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { operationAuditResponse, performAtomicSystemAuditedOperation } from "@/lib/audit/operation-audit";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { pilotCaseFigures, pilotCaseStatsColumns, pilotCaseStatsWindow } from "@/lib/pilot/pilot-measurements";
import type { PilotMilestone } from "@/types/marketing";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const boundedInteger = (raw: string | null, fallback: number, min: number, max: number): number => {
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
};

type CaseStats = { organization_id: string; cases_managed: unknown; resolved_cases: unknown; avg_resolution_hours: unknown };

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

    // Only the organizations the caller directly administers: a platform title or an ancestor's administration grants nothing here.
    const access = await resolveOrganizationAccess(user.userId);
    const permittedOrgIds = [...access.direct]
      .filter(([, role]) => isAdministrativeRole(role))
      .map(([organizationId]) => organizationId);
    if (permittedOrgIds.length === 0) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "The pilot overview is available only to an administrator of an organization"
      );
    }
    const scope = and(eq(pilotEnrollments.status, "active"), inArray(pilotEnrollments.organizationId, permittedOrgIds));

    const params = request ? new URL(request.url).searchParams : new URLSearchParams();
    const limit = boundedInteger(params.get("limit"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const offset = boundedInteger(params.get("offset"), 0, 0, 1_000_000);

    const page = await performAtomicSystemAuditedOperation(
      {
        organizationId: user.organizationId ?? DEFAULT_ORGANIZATION_ID,
        userId: user.userId,
        action: "pilot.overview.read",
        resourceType: "pilot_enrollments",
        details: { limit, offset, organizationCount: permittedOrgIds.length },
      },
      async (tx) => {
      const [{ total }] = (await tx
        .select({ total: sql<number>`count(*)` })
        .from(pilotEnrollments)
        .where(scope)) as Array<{ total: number | string }>;

      const enrollments = await tx
        .select({
          enrollment: pilotEnrollments,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(pilotEnrollments)
        .innerJoin(organizations, eq(pilotEnrollments.organizationId, organizations.id))
        .where(scope)
        .orderBy(asc(pilotEnrollments.enrolledAt), asc(pilotEnrollments.id))
        .limit(limit)
        .offset(offset);

      const orgIds = enrollments.map(({ enrollment }) => enrollment.organizationId);
      const idList = sql.join(orgIds.map((id) => sql`${id}::uuid`), sql`, `);

      // One query per figure for the whole page, not three per organization.
      const milestoneRows = orgIds.length
        ? await tx.select().from(pilotMilestones).where(inArray(pilotMilestones.organizationId, orgIds))
        : [];
      const caseStatRows = orgIds.length
        ? Array.from(
            await tx.execute(sql`
              SELECT
                organization_id::text AS organization_id,
                ${pilotCaseStatsColumns()}
              FROM grievances
              WHERE organization_id IN (${idList})
                AND ${pilotCaseStatsWindow()}
              GROUP BY organization_id
            `),
          ) as unknown as CaseStats[]
        : [];
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

          const figures = pilotCaseFigures(caseStatsByOrg.get(orgId));

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
            organizerAdoptionRate: figures.organizerAdoptionRate,
            memberEngagementRate: figures.memberEngagementRate,
            casesManaged: figures.casesManaged,
            avgTimeToResolution: figures.avgTimeToResolution,
            healthScore: enrollment.healthScore,
            milestones,
            lastCalculated: new Date(),
            measurement: figures.measurement,
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
