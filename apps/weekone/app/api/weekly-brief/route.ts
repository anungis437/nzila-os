import { NextResponse } from "next/server";
import { auth } from "@nzila/platform-auth/entra/server";
import { getDb } from "@/lib/db";
import { generateWeeklyBrief } from "@/lib/ai/weekly-brief";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ data: null, error: "No database connection" }, { status: 503 });
  }
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT * FROM weekone_weekly_briefs ORDER BY week_start_date DESC LIMIT 1`
    );
    const brief = (result as unknown as { rows: unknown[] }).rows?.[0] ?? null;
    return NextResponse.json({ data: brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "No database connection" }, { status: 503 });
  }
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, dealsRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, overdue_invoices FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT COUNT(*) as count, COALESCE(SUM(value * probability / 100), 0) as weighted, MAX(name) as top_name, MAX(value) as top_value FROM weekone_deals WHERE stage != 'closed'`
      ),
    ]);

    const snap =
      snapRow.status === "fulfilled"
        ? (
            snapRow.value as unknown as {
              rows: { cash_on_hand: number; monthly_burn: number; overdue_invoices: number }[];
            }
          ).rows?.[0]
        : null;

    const dealsData =
      dealsRow.status === "fulfilled"
        ? (
            dealsRow.value as unknown as {
              rows: { count: number; weighted: number; top_name: string; top_value: number }[];
            }
          ).rows?.[0]
        : null;

    const brief = generateWeeklyBrief({
      cashOnHand: snap?.cash_on_hand ?? 0,
      monthlyBurn: snap?.monthly_burn ?? 0,
      overdueInvoices: snap?.overdue_invoices ?? 0,
      openDeals: Number(dealsData?.count ?? 0),
      pipelineValue: Number(dealsData?.weighted ?? 0),
      topDeal:
        dealsData?.top_name
          ? { name: dealsData.top_name, value: dealsData.top_value }
          : undefined,
    });

    const result = await db.execute(
      sql`INSERT INTO weekone_weekly_briefs (org_id, week_start_date, summary, priorities, money_watch, pipeline_watch, risk_watch, founder_recommendation) VALUES (1, ${brief.weekStartDate}, ${brief.summary}, ${JSON.stringify(brief.priorities)}, ${brief.moneyWatch}, ${brief.pipelineWatch}, ${brief.riskWatch}, ${brief.founderRecommendation}) RETURNING *`
    );

    return NextResponse.json(
      { data: (result as unknown as { rows: unknown[] }).rows?.[0] },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
