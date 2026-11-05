import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { resolveTelemetryOrganization } from "@/lib/pilot/telemetry-scope";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";
import { assessConversionReadiness } from "@/lib/services/pilot-signals";

/**
 * GET /api/pilot/readiness?organizationId=...
 *
 * Assess conversion readiness for the caller's own organization (a different ?organizationId= is refused).
 */
export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {
  try {
    const scope = resolveTelemetryOrganization(req.nextUrl.searchParams.get("organizationId"), context.organizationId);
    if ("denied" in scope) return scope.denied;
    const orgId = scope.organizationId;

    const readiness = await withRLSContext({ organizationId: orgId }, async () => assessConversionReadiness(orgId));
    return NextResponse.json(readiness);
  } catch (error) {
    logger.error("[pilot/readiness] Error:", error as Error);
    return NextResponse.json({ error: "Failed to assess readiness" }, { status: 500 });
  }
});
