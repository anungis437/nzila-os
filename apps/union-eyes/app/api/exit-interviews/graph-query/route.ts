// cognition-governance-ci: allow-route-bypass — POST with bespoke query schema (queryType + filters + explanationLevel).
/**
 * POST /api/exit-interviews/graph-query
 *
 * Execute explainable queries over organizational dependency graph.
 *
 * Body:
 *   - queryType: 'isolated_knowledge' | 'continuity_bottlenecks' | 'governance_dependencies' | etc.
 *   - filters?: { category?, minimumRiskLevel?, roleFilter?, depthLimit? }
 *   - explanationLevel: 'brief' | 'detailed' | 'exhaustive'
 *
 * Requires: steward+
 * Entitlement: union_knowledge_suite
 */

import { withApi } from '@/lib/api/framework';
import { executeGraphQuery } from '@/lib/knowledge-transfer/graph-query';
import type { GraphQuery } from '@/lib/knowledge-transfer/graph-query';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const GraphQuerySchema = z.object({
  queryType: z.enum([
    'isolated_knowledge',
    'continuity_bottlenecks',
    'governance_dependencies',
    'fragile_operations',
    'vendor_concentration',
    'undocumented_chains',
    'propagation_paths',
    'resilience_weaknesses',
    'knowledge_redundancy',
  ]),
  filters: z.object({
    category: z.string().optional(),
    minimumRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    roleFilter: z.string().optional(),
    depthLimit: z.number().optional(),
  }).optional(),
  explanationLevel: z.enum(['brief', 'detailed', 'exhaustive']),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    body: GraphQuerySchema,
  },
  async ({ organizationId, body }) => {
    const query: GraphQuery = {
      organizationId: organizationId!,
      queryType: body.queryType,
      filters: body.filters,
      explanationLevel: body.explanationLevel,
    };

    const result = await executeGraphQuery(organizationId!, query);
    return { data: result };
  },
);
