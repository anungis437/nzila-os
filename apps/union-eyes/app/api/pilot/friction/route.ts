import { NextRequest, NextResponse } from "next/server";
import { getFrictionReport, getFrictionSummary } from "@/lib/services/pilot-friction";

/**
 * GET /api/pilot/friction?organizationId=...&summary=true
 *
 * Returns friction detection report for the given org.
 * Add &summary=true for counts only ; omit for full user lists.
 */
export async function GET(req: NextRequest) {
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
    console.error("[pilot/friction] Error:", error);
    return NextResponse.json({ error: "Failed to generate friction report" }, { status: 500 });
  }
}
