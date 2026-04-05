import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { assessConversionReadiness } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/readiness?organizationId=...
 *
 * Assess conversion readiness for the given org.
 */
export const GET = withRoleAuth('admin', async (req) => {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const readiness = await assessConversionReadiness(orgId);
    return NextResponse.json(readiness);
  } catch (error) {
    logger.error("[pilot/readiness] Error:", error as Error);
    return NextResponse.json({ error: "Failed to assess readiness" }, { status: 500 });
  }
});
