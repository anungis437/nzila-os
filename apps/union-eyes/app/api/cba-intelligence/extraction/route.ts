import { withApi, ApiError, z } from "@/lib/api/framework";
import { performAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";
import {
  extractDocument,
  runBulkExtraction,
} from "@/lib/services/cba-intelligence/extraction-orchestrator";

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/extraction/run — Run extraction pipeline
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    documentId: z.guid().optional(),
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
        "Run extraction pipeline — single document or all raw documents",
    },
  },
  async ({ body, userId, organizationId }) => {
    // The pipeline reads stored documents and writes extraction runs, findings and agreements across many statements
    // and calls an AI provider, so it cannot share one transaction: its intent is recorded first and nothing runs if
    // that record cannot be written; the outcome is recorded after.
    try {
      return await performAuditedOperation(
        {
          organizationId,
          userId,
          action: body?.documentId ? "cba_intel.extraction.run_document" : "cba_intel.extraction.run_bulk",
          resourceType: "cba_intel_documents",
          resourceId: body?.documentId,
        },
        async () => ({
          data: body?.documentId ? await extractDocument(body.documentId) : await runBulkExtraction(),
        }),
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) throw ApiError.conflict(refused.body.error.message);
      throw error;
    }
  },
);
