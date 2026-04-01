import { withApi, ApiError, z } from "@/lib/api/framework";
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
    const agreement = await getAgreementById(params.id);
    if (!agreement) throw ApiError.notFound("Agreement not found");

    const [wages, clauses] = await Promise.all([
      listWageAdjustments(params.id),
      listClauses(params.id),
    ]);

    return {
      agreement,
      wageAdjustments: wages,
      clauses,
    };
  },
);
