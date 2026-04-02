import { withApi, z } from "@/lib/api/framework";
import { getFreshnessOverview } from "@/lib/services/cba-intelligence/freshness-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/freshness — Freshness overview for all sources
// ---------------------------------------------------------------------------

const querySchema = z.object({
  agingDays: z.coerce.number().int().positive().optional(),
  staleDays: z.coerce.number().int().positive().optional(),
  expiredDays: z.coerce.number().int().positive().optional(),
});

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    query: querySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Freshness overview for all active CBA sources",
    },
  },
  async ({ query }) => {
    const thresholds = {
      agingDays: query.agingDays ?? 14,
      staleDays: query.staleDays ?? 30,
      expiredDays: query.expiredDays ?? 90,
    };
    return { data: await getFreshnessOverview(thresholds) };
  },
);
