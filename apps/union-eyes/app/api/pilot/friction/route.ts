import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { getFrictionReport, getFrictionSummary } from "@/lib/services/pilot-friction";

/**
 * GET /api/pilot/friction?organizationId=...&summary=true
 *
 * Returns friction detection report for the given org.
 * Add &summary=true for counts only ; omit for full user lists.
 */
export const GET = withRoleAuth('admin', async (req) => {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    const summaryOnly = req.nextUrl.searchParams.get("summary") === "true";

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing organizationId" },
        { status: 400 },
      );
    }

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
