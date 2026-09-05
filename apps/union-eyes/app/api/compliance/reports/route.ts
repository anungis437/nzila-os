/**
 * Compliance Reports API
 *
 * GET /api/compliance/reports — List compliance reports for the org
 */

import { db } from "@/db/db";
import {
  employerReports,
} from "@/db/schema/domains/compliance/employer-compliance";
import { employers } from "@/db/schema/union-structure-schema";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { createLogger } from "@nzila/os-core";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, desc, inArray } from "drizzle-orm";

const logger = createLogger("compliance-reports");

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    // Get employer IDs for this org
    const orgEmployers = await db
      .select({ id: employers.id })
      .from(employers)
      .where(eq(employers.organizationId, organizationId));

    const employerIds = orgEmployers.map((e) => e.id);

    if (employerIds.length === 0) {
      return standardSuccessResponse([]);
    }

    const reports = await db
      .select({
        id: employerReports.id,
        employerId: employerReports.employerId,
        reportType: employerReports.reportType,
        dataJson: employerReports.dataJson,
        createdAt: employerReports.createdAt,
        employerName: employers.name,
      })
      .from(employerReports)
      .innerJoin(employers, eq(employers.id, employerReports.employerId))
      .where(inArray(employerReports.employerId, employerIds))
      .orderBy(desc(employerReports.createdAt));

    return standardSuccessResponse(reports);
  } catch (error) {
    logger.error("Failed to list compliance reports", { error: error instanceof Error ? error.message : String(error) });
    return standardSuccessResponse([]);
  }
});
