/**
 * Compliance Alerts API
 *
 * GET /api/compliance/alerts — List compliance alerts for the org
 */

import { db } from "@/db/db";
import { complianceAlerts } from "@/db/schema/domains/compliance/employer-compliance";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { createLogger } from "@nzila/os-core";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, desc } from "drizzle-orm";
import { employers } from "@/db/schema/union-structure-schema";

const logger = createLogger("compliance-alerts");

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    const alerts = await db
      .select({
        id: complianceAlerts.id,
        orgId: complianceAlerts.orgId,
        employerId: complianceAlerts.employerId,
        alertType: complianceAlerts.alertType,
        severity: complianceAlerts.severity,
        message: complianceAlerts.message,
        resolvedAt: complianceAlerts.resolvedAt,
        createdAt: complianceAlerts.createdAt,
        employerName: employers.name,
      })
      .from(complianceAlerts)
      .innerJoin(employers, eq(employers.id, complianceAlerts.employerId))
      .where(eq(complianceAlerts.orgId, organizationId))
      .orderBy(desc(complianceAlerts.createdAt));

    return standardSuccessResponse(alerts);
  } catch (error) {
    logger.error("Failed to list compliance alerts", { error: error instanceof Error ? error.message : String(error) });
    return standardSuccessResponse([]);
  }
});
