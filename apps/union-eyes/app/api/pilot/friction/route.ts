import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveTelemetryOrganization } from "@/lib/pilot/telemetry-scope";
import { logger } from "@/lib/logger";
import { getFrictionReport, getFrictionSummary } from "@/lib/services/pilot-friction";

/**
 * GET /api/pilot/friction?organizationId=...&summary=true
 *
 * Returns the friction detection report for the caller's own organization (a different ?organizationId= is refused).
 * Add &summary=true for counts only ; omit for full user lists.
 */
export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {
  try {
    const scope = resolveTelemetryOrganization(req.nextUrl.searchParams.get("organizationId"), context.organizationId);
    if ("denied" in scope) return scope.denied;
    const orgId = scope.organizationId;
    const summaryOnly = req.nextUrl.searchParams.get("summary") === "true";

    if (summaryOnly) {
      const summary = await getFrictionSummary(orgId);
      return NextResponse.json(summary);
    }

    const report = await getFrictionReport(orgId);
    return NextResponse.json(report);
  } catch (error) {
    logger.error("[pilot/friction] Error:", error as Error);
    return NextResponse.json({ error: "Failed to generate friction report" }, { status: 500 });
  }
});
