import { sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { withRLSContext } from '@/lib/db/with-rls-context';

/**
 * GET /api/analytics/operational/derived-case-metrics
 *
 * Case counts read from the claims table of the caller's organization. They used to be pilot telemetry event counts presented as case
 * figures (open cases as created minus closed events, overdue cases as breached minus closed events), which no case record backed.
 * Overdue cases and SLA compliance are not returned: a claim carries no recorded deadline or status-change time to measure them from.
 */
export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canAccess = await hasMinRole('steward');
  if (!canAccess) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const days = Number(new URL(request.url).searchParams.get('days') ?? '30');
  const boundedDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 30;

  const [counts] = await withRLSContext({ organizationId }, async (tx) => tx.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= NOW() - (${boundedDays} || ' days')::interval)::int AS opened_in_window,
      COUNT(*) FILTER (WHERE closed_at >= NOW() - (${boundedDays} || ' days')::interval)::int AS closed_in_window,
      COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'rejected', 'closed'))::int AS open_now
    FROM claims
    WHERE organization_id = ${organizationId}::uuid
  `)) as unknown as Array<{ opened_in_window: number; closed_in_window: number; open_now: number }>;

  return standardSuccessResponse({
    source: 'claims',
    windowDays: boundedDays,
    cases: {
      opened_in_window: Number(counts?.opened_in_window ?? 0),
      closed_in_window: Number(counts?.closed_in_window ?? 0),
      open_now: Number(counts?.open_now ?? 0),
    },
    // No deadline or status-change time is recorded on a claim, so these are absent rather than estimated.
    overdue_cases: null,
    sla_compliance: null,
  });
});
