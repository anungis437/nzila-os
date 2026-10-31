import { withApi, ApiError } from "@/lib/api/framework";
import { hasMinRole } from "@/lib/api-auth-guard";
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
  async ({ params }) => {
    const reviewer = await hasMinRole("steward");
    const agreement = await getAgreementById(params.id);
    // A member does not learn that an unreviewed extraction exists.
    if (!agreement || (!reviewer && agreement.reviewStatus !== "approved")) throw ApiError.notFound("Agreement not found");

    const [wages, clauses] = await Promise.all([
      listWageAdjustments(params.id, { approvedOnly: !reviewer }),
      listClauses(params.id, { approvedOnly: !reviewer }),
    ]);

    return {
      agreement,
      wageAdjustments: wages,
      clauses,
    };
  },
);
