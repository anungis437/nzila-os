import { NextResponse } from "next/server";
import { requireApiAuth, handleAuthError } from "@/lib/api-auth";
import { platformDb } from "@nzila/db/platform";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/control-plane/integrations/dead-letters
 * List dead letter records for review/replay.
 */
export async function GET(request: Request) {
  try {
    await requireApiAuth(request);

    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const unresolvedOnly = url.searchParams.get("unresolved") === "true";
    const whereRows = orgId
      ? unresolvedOnly
        ? sql`WHERE org_id = ${orgId}::uuid AND replayed = false`
        : sql`WHERE org_id = ${orgId}::uuid`
      : unresolvedOnly
        ? sql`WHERE replayed = false`
        : sql``;
    const whereAll = orgId ? sql`WHERE org_id = ${orgId}::uuid` : sql``;
    const whereUnresolved = orgId ? sql`WHERE org_id = ${orgId}::uuid AND replayed = false` : sql`WHERE replayed = false`;
    const whereReplayed = orgId ? sql`WHERE org_id = ${orgId}::uuid AND replayed = true` : sql`WHERE replayed = true`;

    const deadLetterRows = (await platformDb.execute(sql`
      SELECT id, org_id, connection_id, event_type, error_message, total_attempts, replayed, replayed_at, replayed_by, created_at
      FROM integration_dead_letters
      ${whereRows}
      ORDER BY created_at DESC
      LIMIT 300
    `)) as unknown as Array<{
      id: string;
      org_id: string;
      connection_id: string;
      event_type: string;
      error_message: string;
      total_attempts: number;
      replayed: boolean;
      replayed_at: string | null;
      replayed_by: string | null;
      created_at: string;
    }>;

    const summaryRows = (await platformDb.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM integration_dead_letters ${whereAll}) AS total,
        (SELECT COUNT(*)::int FROM integration_dead_letters ${whereUnresolved}) AS unresolved,
        (SELECT COUNT(*)::int FROM integration_dead_letters ${whereReplayed}) AS replayed
    `)) as unknown as Array<{
      total: number;
      unresolved: number;
      replayed: number;
    }>;

    const summary = summaryRows[0] ?? { total: 0, unresolved: 0, replayed: 0 };

    const data = {
      deadLetters: deadLetterRows,
      summary,
      noData: summary.total === 0,
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * POST /api/control-plane/integrations/dead-letters
 * Replay a dead letter by ID.
 */
export async function POST(request: Request) {
  try {
    await requireApiAuth(request);

    const body = await request.json();
    const { deadLetterId, orgId, actorId, reason } = body as {
      deadLetterId?: string;
      orgId?: string;
      actorId?: string;
      reason?: string;
    };

    if (!deadLetterId) {
      return NextResponse.json({ ok: false, error: "deadLetterId is required" }, { status: 400 });
    }

    const scopedPredicate = orgId
      ? sql`WHERE id = ${deadLetterId}::uuid AND org_id = ${orgId}::uuid`
      : sql`WHERE id = ${deadLetterId}::uuid`;

    const replayRows = (await platformDb.execute(sql`
      UPDATE integration_dead_letters
      SET
        replayed = true,
        replayed_at = NOW(),
        replayed_by = ${actorId ?? "control-plane"},
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'replay_reason', ${reason ?? "control-plane replay trigger"},
          'replay_triggered_at', NOW()
        )
      ${scopedPredicate}
      RETURNING id, org_id, replayed, replayed_at
    `)) as unknown as Array<{ id: string; org_id: string; replayed: boolean; replayed_at: string | null }>;

    if (replayRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Dead letter not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        replayed: true,
        deadLetterId: replayRows[0].id,
        orgId: replayRows[0].org_id,
        replayedAt: replayRows[0].replayed_at,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
