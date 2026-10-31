import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { withApi, ApiError, z } from "@/lib/api/framework";
import { performAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";
import {
  runFullIngestion,
  runSourceIngestion,
} from "@/lib/services/cba-intelligence/ingestion-orchestrator";

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/ingestion/run — Run full ingestion pipeline
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    sourceId: z.guid().optional(),
  })
  .optional();

export const POST = withApi(
  {
    auth: { minRole: "admin" },
    entitlement: "commercial_reporting",
    body: bodySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary:
        "Run ingestion pipeline — single source or all active sources",
    },
  },
  async ({ body, userId, organizationId }) => {
    // The dataset is platform-wide (no organization column): changing it is platform authority, not an organization administrator's.
    await requireSystemAdmin();
    // The pipeline fetches external sources and writes jobs and documents across many statements, so it cannot share
    // one transaction: its intent is recorded first and nothing runs if that record cannot be written.
    try {
      return await performAuditedOperation(
        {
          organizationId,
          userId,
          action: body?.sourceId ? "cba_intel.ingestion.run_source" : "cba_intel.ingestion.run_full",
          resourceType: "cba_intel_sources",
          resourceId: body?.sourceId,
        },
        async () => ({
          data: body?.sourceId ? await runSourceIngestion(body.sourceId) : await runFullIngestion(),
        }),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
