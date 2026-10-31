// cognition-governance-ci: allow-route-bypass — POST with bespoke query schema (queryType + filters + explanationLevel).
/**
 * POST /api/exit-interviews/graph-query
 *
 * Execute explainable queries over organizational dependency graph.
 *
 * Body:
 *   - queryType: 'isolated_knowledge' | 'continuity_bottlenecks' | 'governance_dependencies' | etc.
 *   - filters?: { minimumRiskLevel? } — applied by isolated_knowledge only; any other filter, or this one on another query type, is refused
 *   - explanationLevel?: accepted for compatibility; the reasoner has one level of explanation, and the response says so
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
  // The reasoner reads no category, role or depth filter, so a request that names one is refused rather than answered as though it were applied.
  filters: z.object({
    minimumRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }).strict().optional(),
  explanationLevel: z.enum(['brief', 'detailed', 'exhaustive']).optional(),
}).refine((value) => !value.filters?.minimumRiskLevel || value.queryType === 'isolated_knowledge', {
  message: 'minimumRiskLevel applies to isolated_knowledge queries only',
  path: ['filters', 'minimumRiskLevel'],
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
      explanationLevel: body.explanationLevel ?? 'brief',
    };

    const result = await executeGraphQuery(organizationId!, query);
    // The explanation is the same whatever level was asked for.
    return { data: result, meta: { explanationLevel: 'single_level', appliedFilters: Object.keys(body.filters ?? {}) } };
  },
);
