import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { detectChampions } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/champions?organizationId=...
 *
 * Returns potential champion users within the org.
 */
export const GET = withRoleAuth('admin', async (req) => {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const champions = await detectChampions(orgId);
    return NextResponse.json({ champions });
  } catch (error) {
    logger.error("[pilot/champions] Error:", error as Error);
    return NextResponse.json({ error: "Failed to detect champions" }, { status: 500 });
  }
});
