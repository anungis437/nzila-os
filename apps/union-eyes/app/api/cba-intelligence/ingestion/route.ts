import { withApi, ApiError, z } from "@/lib/api/framework";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import {
  listIngestionJobs,
  createIngestionJob,
} from "@/lib/services/cba-intelligence/ingestion-service";
import { getSourceById } from "@/lib/services/cba-intelligence/source-registry-service";
import type { IngestionJobFilters } from "@/lib/services/cba-intelligence/ingestion-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/ingestion — List ingestion jobs
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sourceId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    query: listQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "List ingestion jobs",
    },
  },
  async ({ query }) => {
    const { page, limit, ...filters } = query;
    return { data: await listIngestionJobs(filters as IngestionJobFilters, { page, limit }) };
  },
);

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/ingestion — Trigger an ingestion job
// ---------------------------------------------------------------------------

const triggerIngestionSchema = z.object({
  sourceId: z.string().uuid(),
  triggerType: z.enum(["manual", "scheduled", "retry"]).default("manual"),
});

export const POST = withApi(
  {
    auth: { minRole: "admin" },
    entitlement: "commercial_reporting",
    body: triggerIngestionSchema,
    successStatus: 201,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Trigger a new ingestion job",
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.badRequest("Organization context required");
    const source = await getSourceById(body.sourceId);
    if (!source) throw ApiError.notFound("Source not found");
    if (!source.isActive) throw ApiError.badRequest("Source is inactive");

    // The job and its audit record commit together.
    const job = await withRLSContext({ organizationId }, async (tx) => {
      const created = await createIngestionJob({
        sourceId: body.sourceId,
        triggerType: body.triggerType,
        triggeredBy: userId,
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "cba_ingestion.job.create",
        resourceType: "cba_intel_ingestion_jobs",
        resourceId: created.id,
        details: { sourceId: body.sourceId, triggerType: body.triggerType },
      });
      return created;
    });
    return { data: job };
  },
);
