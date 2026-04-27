/**
 * Leadership Dashboard API
 *
 * GET /api/dashboard/leadership — aggregate KPI, trends,
 * employer hotspots, steward capacity, and compliance data.
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { emitCapeAuditEvent, CAPE_AUDIT_EVENTS } from "@/lib/audit/cape-audit-events";
import { grievances as leadershipDashboardSchemaAnchor } from "@/db/schema/domains/claims/grievances";
import {
  DashboardTimeframe,
  getLeadershipDashboardMetrics,
} from "@/lib/services/dashboard-kpi-service";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  void leadershipDashboardSchemaAnchor;

  try {
    const canAccess = await hasMinRole("officer");
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        "Requires officer role or above"
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframeParam = (searchParams.get("timeframe") ?? "monthly").toLowerCase();
    const timeframe: DashboardTimeframe =
      timeframeParam === "weekly" || timeframeParam === "quarterly" || timeframeParam === "monthly"
        ? timeframeParam
        : "monthly";

    const metrics = await getLeadershipDashboardMetrics({
      organizationId,
      timeframe,
    });

    // Audit
    await emitCapeAuditEvent({
      eventType: CAPE_AUDIT_EVENTS.LEADERSHIP_REPORT_VIEWED,
      userId,
      organizationId,
      resource: "leadership_dashboard",
      details: { timeframe },
    });

    return standardSuccessResponse(metrics);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to load leadership dashboard"
    );
  }
});

// Metrics and aggregation logic lives in lib/services/dashboard-kpi-service.ts
