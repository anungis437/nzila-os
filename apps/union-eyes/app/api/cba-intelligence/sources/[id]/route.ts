import { withApi, ApiError, z } from "@/lib/api/framework";
import {
  getSourceById,
  updateSource,
  deactivateSource,
} from "@/lib/services/cba-intelligence/source-registry-service";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/sources/[id] — Get source details
// ---------------------------------------------------------------------------

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Get CBA source details",
    },
  },
  async ({ params }) => {
    const source = await getSourceById(params.id);
    if (!source) throw ApiError.notFound("Source not found");
    return { data: source };
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/cba-intelligence/sources/[id] — Update source
// ---------------------------------------------------------------------------

const updateSourceSchema = z.object({
  nameEn: z.string().min(1).max(255).optional(),
  nameFr: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  sourceType: z.string().optional(),
  formatTypes: z.array(z.string()).optional(),
  collectionMethod: z.string().optional(),
  trustTier: z.string().optional(),
  jurisdictions: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  baseUrl: z.string().url().optional(),
  apiEndpoint: z.string().url().nullable().optional(),
  feedUrl: z.string().url().nullable().optional(),
  updateCadence: z.string().max(100).optional(),
  expectedUpdateDays: z.number().int().positive().optional(),
  robotsNotes: z.string().max(2000).optional(),
  termsUrl: z.string().url().nullable().optional(),
  redistributionNotes: z.string().max(2000).optional(),
  provenanceRules: z.record(z.unknown()).optional(),
  adapterKey: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = withApi(
  {
    auth: { minRole: "admin" },
    entitlement: "commercial_reporting",
    body: updateSourceSchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Update a CBA source",
    },
  },
  async ({ params, body }) => {
    const { isActive, ...updateData } = body;

    // Handle deactivation separately
    if (isActive === false) {
      await deactivateSource(params.id);
    }

    if (Object.keys(updateData).length > 0) {
      return { data: await updateSource(params.id, updateData as Record<string, unknown>) };
    }

    const source = await getSourceById(params.id);
    if (!source) throw ApiError.notFound("Source not found");
    return { data: source };
  },
);
