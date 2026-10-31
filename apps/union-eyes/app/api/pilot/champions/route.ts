import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveTelemetryOrganization } from "@/lib/pilot/telemetry-scope";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";
import { detectChampions } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/champions?organizationId=...
 *
 * Returns potential champion users within the caller's own organization (a different ?organizationId= is refused).
 */
export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {
  try {
    const scope = resolveTelemetryOrganization(req.nextUrl.searchParams.get("organizationId"), context.organizationId);
    if ("denied" in scope) return scope.denied;
    const orgId = scope.organizationId;

    const champions = await withRLSContext({ organizationId: orgId }, async () => detectChampions(orgId));
    return NextResponse.json({ champions });
  } catch (error) {
    logger.error("[pilot/champions] Error:", error as Error);
    return NextResponse.json({ error: "Failed to detect champions" }, { status: 500 });
  }
});
