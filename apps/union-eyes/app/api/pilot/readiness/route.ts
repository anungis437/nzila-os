import { NextRequest, NextResponse } from "next/server";
import { assessConversionReadiness } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/readiness?organizationId=...
 *
 * Assess conversion readiness for the given org.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const readiness = await assessConversionReadiness(orgId);
    return NextResponse.json(readiness);
  } catch (error) {
    console.error("[pilot/readiness] Error:", error);
    return NextResponse.json({ error: "Failed to assess readiness" }, { status: 500 });
  }
}
