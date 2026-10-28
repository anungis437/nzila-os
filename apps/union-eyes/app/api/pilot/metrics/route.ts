import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveTelemetryOrganization } from "@/lib/pilot/telemetry-scope";
import { logger } from "@/lib/logger";
import { getPilotMetrics, getDAUTrend } from "@/lib/services/pilot-metrics";

/**
 * GET /api/pilot/metrics?organizationId=...&trend=true
 *
 * Returns pilot engagement metrics for the caller's own organization (a different ?organizationId= is refused).
 * Add &trend=true to include a 30-day DAU trend.
 */
export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {
  try {
    const scope = resolveTelemetryOrganization(req.nextUrl.searchParams.get("organizationId"), context.organizationId);
    if ("denied" in scope) return scope.denied;
    const orgId = scope.organizationId;
    const includeTrend = req.nextUrl.searchParams.get("trend") === "true";

    const metrics = await getPilotMetrics(orgId);

    if (includeTrend) {
      const trend = await getDAUTrend(orgId, 30);
      return NextResponse.json({ ...metrics, dauTrend: trend });
    }

    return NextResponse.json(metrics);
  } catch (error) {
    logger.error("[pilot/metrics] Error:", error as Error);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
});
