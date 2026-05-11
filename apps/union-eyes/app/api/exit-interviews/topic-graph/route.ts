// cognition-governance-ci: allow-route-bypass — Augmented with role-checking and OpenAPI metadata; bespoke shape.
/**
 * GET /api/exit-interviews/topic-graph
 *
 * Returns the organizational operational knowledge topic graph.
 * Nodes = topic areas, edges = co-occurrence relationships.
 *
 * Access: steward+
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { buildTopicGraph } from '@/lib/knowledge-transfer/topic-graph/topic-graph-builder';

export const dynamic = 'force-dynamic';

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  return (ROLE_HIERARCHY[normalized] ?? 0) >= ROLE_HIERARCHY.steward;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get operational topic graph',
      description: 'Knowledge relationship map across all published exit interviews.',
    },
  },
  async ({ organizationId, user }) => {
    if (!hasStewardPrivileges(user?.role ?? null)) {
      throw ApiError.forbidden('Steward-level access required');
    }

    const graph = await buildTopicGraph(organizationId!);
    return { data: graph };
  },
);
