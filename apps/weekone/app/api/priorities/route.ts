import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { calculateRunway } from "@/domain/runway";
import { rankPriorities } from "@/domain/priorities";

export async function GET() {
  const db = await getDb();
  if (!db) {
    const defaultPriorities = rankPriorities({
      runwayDays: 180,
      pipelineValue: 0,
      overdueInvoices: 0,
    });
    return NextResponse.json({ data: defaultPriorities });
  }
  try {
    const { sql } = await import("drizzle-orm");
    const [snapRow, dealsRow] = await Promise.allSettled([
      db.execute(
        sql`SELECT cash_on_hand, monthly_burn, overdue_invoices FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 1`
      ),
      db.execute(
        sql`SELECT COALESCE(SUM(value * probability / 100), 0) as weighted, MAX(name) as top_name, MAX(value) as top_value FROM weekone_deals WHERE stage != 'closed'`
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
              rows: { weighted: number; top_name: string; top_value: number }[];
            }
          ).rows?.[0]
        : null;

    const runwayDays = snap
      ? calculateRunway({ cashOnHand: snap.cash_on_hand, monthlyBurn: snap.monthly_burn })
      : 180;

    const priorities = rankPriorities({
      runwayDays,
      pipelineValue: Number(dealsData?.weighted ?? 0),
      overdueInvoices: snap?.overdue_invoices ?? 0,
      topDeal:
        dealsData?.top_name
          ? { name: dealsData.top_name, value: dealsData.top_value }
          : undefined,
    });

    return NextResponse.json({ data: priorities });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
