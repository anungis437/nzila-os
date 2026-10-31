import { withApi, ApiError, z } from "@/lib/api/framework";
import { listAgreements } from "@/lib/services/cba-intelligence/extraction-service";
import { NextResponse } from "next/server";
import { hasMinRole } from "@/lib/api-auth-guard";
import { reviewStatusFilter } from "@/lib/services/cba-intelligence/review-visibility";

const LIST_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10000;

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/agreements/export — CSV export
// ---------------------------------------------------------------------------

const exportQuerySchema = z.object({
  search: z.string().max(200).optional(),
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
  async ({ query: requested }) => {
    const query = { ...requested, reviewStatus: reviewStatusFilter(await hasMinRole("steward"), requested.reviewStatus) };
    // listAgreements serves at most 100 rows a page whatever limit is asked, so the export reads every page. When the
    // matching set is larger than the export bound the request is refused: a file that silently stops at the first page is not
    // the export that was asked for.
    const first = await listAgreements(query, { page: 1, limit: LIST_PAGE_SIZE });
    if (first.total > MAX_EXPORT_ROWS) {
      throw ApiError.badRequest(
        `The export would contain ${first.total} agreements, over the limit of ${MAX_EXPORT_ROWS}. Narrow the filters and try again.`,
      );
    }
    const rows = [...first.items];
    for (let page = 2; rows.length < first.total; page += 1) {
      const next = await listAgreements(query, { page, limit: LIST_PAGE_SIZE });
      if (next.items.length === 0) break;
      rows.push(...next.items);
    }

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
