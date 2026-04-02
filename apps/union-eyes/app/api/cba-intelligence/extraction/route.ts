import { withApi, z } from "@/lib/api/framework";
import {
  extractDocument,
  runBulkExtraction,
} from "@/lib/services/cba-intelligence/extraction-orchestrator";

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/extraction/run — Run extraction pipeline
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    documentId: z.string().uuid().optional(),
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
  async ({ body }) => {
    if (body?.documentId) {
      return { data: await extractDocument(body.documentId) };
    }
    return { data: await runBulkExtraction() };
  },
);
