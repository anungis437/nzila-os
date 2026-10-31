import { withApi, ApiError, z } from "@/lib/api/framework";
import {
  findComparableAgreements,
  saveBenchmarkSnapshot,
  getBenchmarkSnapshots,
} from "@/lib/services/cba-intelligence/benchmark-service";
import { getAgreementById } from "@/lib/services/cba-intelligence/extraction-service";
import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { performAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/benchmark/[id] — Compute or retrieve benchmark
// ---------------------------------------------------------------------------

const querySchema = z.object({
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  union: z.string().optional(),
  employerClass: z.string().optional(),
  minComparables: z.coerce.number().int().positive().optional(),
  // A read does not write. Saving a snapshot is POST (platform authority, audited); a request that still asks a GET to save is refused.
  save: z.undefined({ error: "Saving a benchmark snapshot is POST /api/cba-intelligence/benchmark/[id]" }),
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
  async ({ params, query }) => {
    const agreementId = params.id;

    // Return saved snapshots if requested
    if (query.history) {
      const snapshots = await getBenchmarkSnapshots(agreementId, {
        page: query.page,
        limit: query.limit,
      });
      return { data: snapshots };
    }

    const agreement = await getAgreementById(agreementId);
    if (!agreement) throw ApiError.notFound("Agreement not found");

    const { history: _history, page: _page, limit: _limit, ...filters } = query;
    const result = await findComparableAgreements(agreementId, filters as Record<string, unknown>);

    return { data: result };
  },
);

const saveSchema = z.object({
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  union: z.string().optional(),
  employerClass: z.string().optional(),
  minComparables: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/benchmark/[id] — Compute and persist a snapshot
// The snapshots belong to the platform-wide CBA dataset (no organization column), so persisting one is platform authority, and the intent
// is recorded before the write: a snapshot whose audit cannot be written is not stored.
// ---------------------------------------------------------------------------
export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    body: saveSchema,
    successStatus: 201,
    openapi: { tags: ["CBA Intelligence"], summary: "Compute and save a benchmark snapshot" },
  },
  async ({ params, body, userId, organizationId }) => {
    await requireSystemAdmin();
    if (!userId) throw ApiError.unauthorized("User context required");
    const agreement = await getAgreementById(params.id);
    if (!agreement) throw ApiError.notFound("Agreement not found");
    try {
      return await performAuditedOperation(
        { organizationId, userId, action: "cba_benchmark.snapshot", resourceType: "cba_intel_benchmark_snapshots", resourceId: params.id, details: { filters: Object.keys(body) } },
        async () => {
          const result = await findComparableAgreements(params.id, body as Record<string, unknown>);
          const snapshot = await saveBenchmarkSnapshot(result, userId);
          return { data: { ...result, snapshotId: snapshot.id } };
        },
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
