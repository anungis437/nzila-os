import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const dealSchema = z.object({
  name: z.string().min(1),
  value: z.number().positive(),
  stage: z.enum(["discovery", "proposal", "negotiation", "closed"]),
  probability: z.number().int().min(0).max(100).default(50),
  expectedCloseDate: z.string().optional(),
});

export async function GET() {
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ data: [], error: "No database connection" }, { status: 503 });
  }
  try {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`SELECT * FROM weekone_deals ORDER BY value DESC LIMIT 50`
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
    const parsed = dealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, value, stage, probability, expectedCloseDate } = parsed.data;
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(
      sql`INSERT INTO weekone_deals (org_id, name, value, stage, probability, expected_close_date) VALUES (1, ${name}, ${value}, ${stage}, ${probability}, ${expectedCloseDate ?? null}) RETURNING *`
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
