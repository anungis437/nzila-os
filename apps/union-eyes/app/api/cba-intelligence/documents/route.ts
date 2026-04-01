import { withApi, z } from "@/lib/api/framework";
import { listDocuments } from "@/lib/services/cba-intelligence/document-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/documents — List source documents
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sourceId: z.string().uuid().optional(),
  documentType: z.string().optional(),
  processingStatus: z.string().optional(),
  jurisdiction: z.string().optional(),
  sector: z.string().optional(),
  language: z.string().optional(),
  isLatest: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export const GET = withApi(
  {
    auth: { minRole: "member" },
    entitlement: "commercial_reporting",
    query: listQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "List CBA source documents",
    },
  },
  async ({ query }) => {
    const { page, limit, ...filters } = query;
    return listDocuments(filters, { page, limit });
  },
);
