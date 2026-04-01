import { withApi, z } from "@/lib/api/framework";
import { db } from "@/db/db";
import { cbaIntelAgreements } from "@/db/schema";
import { eq, and, ilike, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/agreements/export — CSV export
// ---------------------------------------------------------------------------

const exportQuerySchema = z.object({
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  reviewStatus: z.string().optional(),
});

const CSV_COLUMNS = [
  "id",
  "title",
  "employer_normalized",
  "union_normalized",
  "local_entity",
  "jurisdiction",
  "sector",
  "effective_date",
  "expiry_date",
  "term_months",
  "employee_coverage",
  "review_status",
  "overall_confidence",
  "source_url",
  "created_at",
] as const;

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "commercial_reporting",
    query: exportQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Export CBA agreements as CSV",
    },
  },
  async ({ query }) => {
    const conditions: SQL[] = [];

    if (query.jurisdiction) {
      conditions.push(eq(cbaIntelAgreements.jurisdiction, query.jurisdiction));
    }
    if (query.sector) {
      conditions.push(ilike(cbaIntelAgreements.sector, query.sector));
    }
    if (query.reviewStatus) {
      conditions.push(eq(cbaIntelAgreements.reviewStatus, query.reviewStatus));
    }

    const rows = await db
      .select()
      .from(cbaIntelAgreements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(10000);

    const header = CSV_COLUMNS.join(",");
    const lines = rows.map((row) =>
      [
        escapeCsvField(row.id),
        escapeCsvField(row.title),
        escapeCsvField(row.employerNormalized),
        escapeCsvField(row.unionNormalized),
        escapeCsvField(row.localEntity),
        escapeCsvField(row.jurisdiction),
        escapeCsvField(row.sector),
        escapeCsvField(row.effectiveDate?.toISOString() ?? null),
        escapeCsvField(row.expiryDate?.toISOString() ?? null),
        escapeCsvField(row.termMonths),
        escapeCsvField(row.employeeCoverage),
        escapeCsvField(row.reviewStatus),
        escapeCsvField(row.overallConfidence),
        escapeCsvField(row.sourceUrl),
        escapeCsvField(row.createdAt?.toISOString() ?? null),
      ].join(","),
    );

    const csv = [header, ...lines].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cba-agreements-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  },
);
