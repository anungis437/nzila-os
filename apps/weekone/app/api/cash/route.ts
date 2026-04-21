import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { calculateRunway } from "@/domain/runway";
import { z } from "zod";

const snapshotSchema = z.object({
  cashOnHand: z.number().positive(),
  monthlyBurn: z.number().nonnegative(),
  overdueInvoices: z.number().int().nonnegative().default(0),
  upcomingBills: z.number().nonnegative().default(0),
});

export async function GET() {
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ data: null, error: "No database connection" }, { status: 503 });
  }
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT * FROM weekone_cash_snapshots ORDER BY recorded_at DESC LIMIT 10`
    );
    return NextResponse.json({ data: (result as unknown as { rows: unknown[] }).rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "No database connection" }, { status: 503 });
  }
  try {
    const body = await req.json() as unknown;
    const parsed = snapshotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { cashOnHand, monthlyBurn, overdueInvoices, upcomingBills } = parsed.data;
    const runwayDays = calculateRunway({ cashOnHand, monthlyBurn });
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`INSERT INTO weekone_cash_snapshots (org_id, cash_on_hand, monthly_burn, runway_days, overdue_invoices, upcoming_bills) VALUES (1, ${cashOnHand}, ${monthlyBurn}, ${runwayDays === Infinity ? 99999 : runwayDays}, ${overdueInvoices}, ${upcomingBills}) RETURNING *`
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
