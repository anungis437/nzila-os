const fs = require('fs')
const file = 'app/api/cba-intelligence/benchmark/[id]/route.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sub = (from, to) => {
  if (!t.includes(from)) throw new Error('missing: ' + from.slice(0, 60))
  t = t.replace(from, to)
}
sub('import { getAgreementById } from "@/lib/services/cba-intelligence/extraction-service";', `import { getAgreementById } from "@/lib/services/cba-intelligence/extraction-service";
import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { performAuditedOperation, operationAuditResponse } from "@/lib/audit/operation-audit";`)
sub(`  save: z
    .string()
    .optional()
    .transform((v) => v === "true"),
`, `  // A read does not write. Saving a snapshot is POST (platform authority, audited); a request that still asks a GET to save is refused.
  save: z.undefined({ error: "Saving a benchmark snapshot is POST /api/cba-intelligence/benchmark/[id]" }),
`)
sub('  async ({ params, query, userId }) => {\n    const agreementId = params.id;', '  async ({ params, query }) => {\n    const agreementId = params.id;')
sub('const { save, history: _history,', 'const { history: _history,')
sub(`    // Persist snapshot if requested
    if (save && userId) {
      const snapshot = await saveBenchmarkSnapshot(result, userId);
      return { data: { ...result, snapshotId: snapshot.id } };
    }

    return { data: result };
  },
);`, `    return { data: result };
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
);`)
fs.writeFileSync(file, t)
console.log('ok')
