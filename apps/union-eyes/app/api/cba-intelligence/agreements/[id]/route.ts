import { withApi, ApiError } from "@/lib/api/framework";
import { canReadUnreviewed } from "@/lib/services/cba-intelligence/review-visibility";
import {
  getAgreementById,
  listWageAdjustments,
  listClauses,
} from "@/lib/services/cba-intelligence/extraction-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/agreements/[id] — Get agreement with wages + clauses
// ---------------------------------------------------------------------------

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "commercial_reporting",
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Get agreement details with wage adjustments and clauses",
    },
  },
  async ({ params, userId }) => {
    const curator = await canReadUnreviewed(userId);
    const agreement = await getAgreementById(params.id);
    // A reader does not learn that an unreviewed extraction exists; only the platform staff who curate the dataset see it.
    if (!agreement || (!curator && agreement.reviewStatus !== "approved")) throw ApiError.notFound("Agreement not found");

    const [wages, clauses] = await Promise.all([
      listWageAdjustments(params.id, { approvedOnly: !curator }),
      listClauses(params.id, { approvedOnly: !curator }),
    ]);

    return {
      agreement,
      wageAdjustments: wages,
      clauses,
    };
  },
);
