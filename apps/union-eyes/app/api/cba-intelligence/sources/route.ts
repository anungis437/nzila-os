import { withApi, z } from "@/lib/api/framework";
import {
  listSources,
  createSource,
  type NewCbaIntelSource,
} from "@/lib/services/cba-intelligence/source-registry-service";
import { auditDataMutation } from "@/lib/audit-logger";

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/sources — List CBA intelligence sources
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sourceType: z.string().optional(),
  jurisdiction: z.string().optional(),
  healthStatus: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    query: listQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "List CBA intelligence sources",
    },
  },
  async ({ query }) => {
    const { page, limit, ...filters } = query;
    return { data: await listSources(filters as Record<string, unknown>, { page, limit }) };
  },
);

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/sources — Register a new source
// ---------------------------------------------------------------------------

const createSourceSchema = z.object({
  slug: z.string().min(2).max(100),
  nameEn: z.string().min(1).max(255),
  nameFr: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  sourceType: z.string(),
  formatTypes: z.array(z.string()).optional(),
  collectionMethod: z.string(),
  trustTier: z.string(),
  jurisdictions: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  baseUrl: z.string().url().optional(),
  apiEndpoint: z.string().url().optional(),
  feedUrl: z.string().url().optional(),
  updateCadence: z.string().max(100).optional(),
  expectedUpdateDays: z.number().int().positive().optional(),
  robotsNotes: z.string().max(2000).optional(),
  termsUrl: z.string().url().optional(),
  redistributionNotes: z.string().max(2000).optional(),
  provenanceRules: z.record(z.unknown()).optional(),
  adapterKey: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: "admin" },
    entitlement: "commercial_reporting",
    body: createSourceSchema,
    successStatus: 201,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Register a new CBA intelligence source",
    },
  },
  async ({ body, userId, organizationId }) => {
    const source = await createSource(body as unknown as NewCbaIntelSource);
    await auditDataMutation({
      userId: userId!,
      organizationId: organizationId!,
      resource: 'cba_intel_sources',
      action: 'create',
      details: { slug: body.slug, nameEn: body.nameEn, sourceType: body.sourceType },
    });
    return { data: source };
  },
);
