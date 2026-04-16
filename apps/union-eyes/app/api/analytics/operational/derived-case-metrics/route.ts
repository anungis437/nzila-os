import { sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canAccess = await hasMinRole('member');
  if (!canAccess) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const days = Number(new URL(request.url).searchParams.get('days') ?? '30');
  const boundedDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;

  const [eventStats] = await withRLSContext(async () => db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'case_created')::int AS case_created,
      COUNT(*) FILTER (WHERE event_type = 'case_closed')::int AS case_closed,
      COUNT(*) FILTER (WHERE event_type = 'sla_breached')::int AS sla_breached,
      COUNT(*) FILTER (WHERE event_type = 'sla_breach_risk')::int AS sla_breach_risk
    FROM pilot_events
    WHERE organization_id = ${organizationId}::uuid
      AND created_at >= NOW() - (${boundedDays} || ' days')::interval
  `)) as Array<{
    case_created: number;
    case_closed: number;
    sla_breached: number;
    sla_breach_risk: number;
  }>;

  const created = Number(eventStats?.case_created ?? 0);
  const closed = Number(eventStats?.case_closed ?? 0);
  const breached = Number(eventStats?.sla_breached ?? 0);
  const atRisk = Number(eventStats?.sla_breach_risk ?? 0);

  const openCases = Math.max(0, created - closed);
  const overdueCases = Math.max(0, breached - closed);
  const slaCompliance = created > 0 ? Number((((created - breached) / created) * 100).toFixed(2)) : 100;

  return standardSuccessResponse({
    windowDays: boundedDays,
    events: {
      case_created: created,
      case_closed: closed,
      sla_breached: breached,
      sla_breach_risk: atRisk,
    },
    derived: {
      open_cases: openCases,
      overdue_cases: overdueCases,
      sla_compliance: slaCompliance,
    },
  });
});
