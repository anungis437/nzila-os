// cognition-governance-ci: allow-route-bypass — Search endpoint; not a cognition engine.
import { withApi, z } from '@/lib/api/framework';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { hybridKnowledgeSearch } from '@/lib/knowledge-transfer/search/hybrid-search';
import type { ExitInterviewSensitivityLevel } from '@/db/schema';

export const dynamic = 'force-dynamic';

const searchSchema = z.object({
  q: z.string().min(2),
  /** 0–1 weight for semantic vs keyword. Default 0.6. */
  semanticWeight: z.number().min(0).max(1).default(0.6).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Sensitivity levels accessible per role tier */
function allowedSensitivityLevels(role: string | null): ExitInterviewSensitivityLevel[] {
  const normalized = normalizeRole((role ?? 'member') as never);
  const level = ROLE_HIERARCHY[normalized] ?? 0;
  if (level >= ROLE_HIERARCHY.admin) {
    return ['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential'];
  }
  if (level >= ROLE_HIERARCHY.officer) {
    return ['public_internal', 'restricted', 'privileged'];
  }
  if (level >= ROLE_HIERARCHY.steward) {
    return ['public_internal', 'restricted'];
  }
  return ['public_internal'];
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: searchSchema,
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Search exit interview knowledge base',
      description: 'Hybrid semantic + keyword search across published interview knowledge. Governance-aware, role-scoped.',
    },
  },
  async ({ organizationId, body, user }) => {
    const results = await hybridKnowledgeSearch({
      query: body.q,
      orgId: organizationId!,
      allowedSensitivityLevels: allowedSensitivityLevels(user?.role ?? null),
      limit: body.limit,
      semanticWeight: body.semanticWeight ?? 0.6,
    });

    return { data: results, total: results.length };
  },
);
