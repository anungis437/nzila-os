import { NextRequest, NextResponse } from "next/server";
import { getPilotMetrics, getDAUTrend } from "@/lib/services/pilot-metrics";

/**
 * GET /api/pilot/metrics?organizationId=...&trend=true
 *
 * Returns pilot engagement metrics for the given org.
 * Add &trend=true to include a 30-day DAU trend.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    const includeTrend = req.nextUrl.searchParams.get("trend") === "true";

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing organizationId" },
        { status: 400 },
      );
    }

    const metrics = await getPilotMetrics(orgId);

    if (includeTrend) {
      const trend = await getDAUTrend(orgId, 30);
      return NextResponse.json({ ...metrics, dauTrend: trend });
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[pilot/metrics] Error:", error);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
