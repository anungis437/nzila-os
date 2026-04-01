import { withApi, ApiError, z } from "@/lib/api/framework";
import {
  findComparableAgreements,
  saveBenchmarkSnapshot,
  getBenchmarkSnapshots,
} from "@/lib/services/cba-intelligence/benchmark-service";
import { getAgreementById } from "@/lib/services/cba-intelligence/extraction-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/benchmark/[id] — Compute or retrieve benchmark
// ---------------------------------------------------------------------------

const querySchema = z.object({
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  union: z.string().optional(),
  employerClass: z.string().optional(),
  minComparables: z.coerce.number().int().positive().optional(),
  save: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  history: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    query: querySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Compute or retrieve benchmark for an agreement",
    },
  },
  async ({ params, query, userId }) => {
    const agreementId = params.id;

    // Return saved snapshots if requested
    if (query.history) {
      return getBenchmarkSnapshots(agreementId, {
        page: query.page,
        limit: query.limit,
      });
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) throw ApiError.notFound("Agreement not found");

    const { save, history, page, limit, ...filters } = query;
    const result = await findComparableAgreements(agreementId, filters);

    // Persist snapshot if requested
    if (save && userId) {
      const snapshot = await saveBenchmarkSnapshot(result, userId);
      return { ...result, snapshotId: snapshot.id };
    }

    return result;
  },
);
