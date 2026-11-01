import { withApi, z } from "@/lib/api/framework";
import { canReadUnreviewed, reviewStatusFilter } from "@/lib/services/cba-intelligence/review-visibility";
import {
  listAgreements,
} from "@/lib/services/cba-intelligence/extraction-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/agreements — List extracted agreements
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  search: z.string().max(200).optional(),
  reviewStatus: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "commercial_reporting",
    query: listQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "List CBA agreements with search and filters",
    },
  },
  async ({ query, userId }) => {
    const { page, limit, ...filters } = query;
    // A reader sees approved agreements only; only the platform staff who curate the dataset may name any review status.
    return listAgreements({ ...filters, reviewStatus: reviewStatusFilter(await canReadUnreviewed(userId), filters.reviewStatus) }, { page, limit });
  },
);
