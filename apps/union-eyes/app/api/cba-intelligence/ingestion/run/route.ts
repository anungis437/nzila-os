import { withApi, z } from "@/lib/api/framework";
import {
  runFullIngestion,
  runSourceIngestion,
} from "@/lib/services/cba-intelligence/ingestion-orchestrator";

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/ingestion/run — Run full ingestion pipeline
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    sourceId: z.string().uuid().optional(),
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
  async ({ body }) => {
    if (body?.sourceId) {
      return runSourceIngestion(body.sourceId);
    }
    return runFullIngestion();
  },
);
