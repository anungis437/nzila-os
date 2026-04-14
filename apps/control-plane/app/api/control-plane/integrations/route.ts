import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { platformDb } from "@nzila/db/platform";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/control-plane/integrations
 * List all integration connections with summary stats.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const orgFilter = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereConnections = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereConnectionsActive = orgId ? sql`WHERE org_id = ${orgId}::uuid AND status = 'active'` : sql`WHERE status = 'active'`;
    const whereConnectionsError = orgId ? sql`WHERE org_id = ${orgId}::uuid AND status = 'error'` : sql`WHERE status = 'error'`;
    const whereConnectionsPending = orgId ? sql`WHERE org_id = ${orgId}::uuid AND status = 'pending'` : sql`WHERE status = 'pending'`;
    const whereRuns = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereAttempts = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereDeadLetters = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereDeadLettersUnresolved = orgId ? sql`WHERE org_id = ${orgId}::uuid AND replayed = false` : sql`WHERE replayed = false`;

    const connectionRows = (await platformDb.execute(sql`
      SELECT id, org_id, connector_id, connector_type, name, status, created_at, updated_at
      FROM integration_connections
      ${orgFilter}
      ORDER BY created_at DESC
      LIMIT 200
    `)) as unknown as Array<{
      id: string;
      org_id: string;
      connector_id: string;
      connector_type: string;
      name: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>;

    const summaryRows = (await platformDb.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM integration_connections ${whereConnections}) AS connection_total,
        (SELECT COUNT(*)::int FROM integration_connections ${whereConnectionsActive}) AS connection_active,
        (SELECT COUNT(*)::int FROM integration_connections ${whereConnectionsError}) AS connection_error,
        (SELECT COUNT(*)::int FROM integration_connections ${whereConnectionsPending}) AS connection_pending,
        (SELECT COUNT(*)::int FROM integration_runs ${whereRuns}) AS run_total,
        (SELECT COUNT(*)::int FROM integration_delivery_attempts ${whereAttempts}) AS delivery_attempt_total,
        (SELECT COUNT(*)::int FROM integration_dead_letters ${whereDeadLetters}) AS dead_letter_total,
        (SELECT COUNT(*)::int FROM integration_dead_letters ${whereDeadLettersUnresolved}) AS dead_letter_unresolved
    `)) as unknown as Array<{
      connection_total: number;
      connection_active: number;
      connection_error: number;
      connection_pending: number;
      run_total: number;
      delivery_attempt_total: number;
      dead_letter_total: number;
      dead_letter_unresolved: number;
    }>;

    const summary = summaryRows[0] ?? {
      connection_total: 0,
      connection_active: 0,
      connection_error: 0,
      connection_pending: 0,
      run_total: 0,
      delivery_attempt_total: 0,
      dead_letter_total: 0,
      dead_letter_unresolved: 0,
    };

    const data = {
      connections: connectionRows,
      summary: {
        total: summary.connection_total,
        active: summary.connection_active,
        error: summary.connection_error,
        pending: summary.connection_pending,
        runs: summary.run_total,
        deliveryAttempts: summary.delivery_attempt_total,
        deadLetters: summary.dead_letter_total,
        unresolvedDeadLetters: summary.dead_letter_unresolved,
      },
      noData: summary.connection_total === 0,
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleAuthError(error);
  }
}
