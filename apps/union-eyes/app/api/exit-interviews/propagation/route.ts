// cognition-governance-ci: allow-route-bypass — Parameterized: nodeId/analysisType filtering, response shape diverges from kernel.
/**
 * GET /api/exit-interviews/propagation
 *
 * Analyze organizational dependency propagation.
 * Trace how knowledge loss impacts operations.
 *
 * Query params:
 *   - nodeId (optional): specific node to analyze
 *   - analysisType: 'downstream' | 'upstream' | 'coupling' | 'full'
 *
 * Requires: steward+
 * Entitlement: union_knowledge_suite
 */

import { withApi, ApiError, z } from '@/lib/api/framework';
import { buildDependencyPropagationMap } from '@/lib/knowledge-transfer/propagation';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  nodeId: z.string().trim().min(1).max(200).optional(),
  analysisType: z.enum(['downstream', 'upstream', 'coupling', 'full']).default('full'),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId, request }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) throw ApiError.badRequest('nodeId must be text and analysisType one of downstream, upstream, coupling or full');
    const { nodeId, analysisType } = parsed.data;

    const propagationMap = await buildDependencyPropagationMap(organizationId);

    if (!propagationMap.nodes.length) {
      if (nodeId) throw ApiError.notFound('node', nodeId);
      return {
        data: propagationMap,
        meta: { message: 'No published interviews found to analyze' },
      };
    }

    // Filter to specific node if requested
    if (nodeId) {
      const node = propagationMap.nodes.find((n) => n.id === nodeId);
      if (!node) {
        throw ApiError.notFound('node', nodeId);
      }

      const downstreamImpact = propagationMap.downstreamImpacts.find((d) => d.nodeId === nodeId);
      const upstreamDeps = propagationMap.upstreamDependencies.find((u) => u.nodeId === nodeId);
      const coupling = propagationMap.couplingAnalysis.find((c) => c.nodeId === nodeId);

      // The node view honours analysisType too: each type returns only its own section next to the node.
      return {
        data: {
          node,
          downstreamImpact: analysisType === 'upstream' || analysisType === 'coupling' ? undefined : downstreamImpact,
          upstreamDependencies: analysisType === 'downstream' || analysisType === 'coupling' ? undefined : upstreamDeps,
          couplingAnalysis: analysisType === 'downstream' || analysisType === 'upstream' ? undefined : coupling,
        },
      };
    }

    // Return full map, potentially filtered by analysis type
    // Each analysis type returns its own section: coupling no longer returns the downstream and upstream lists as well.
    const filtered = {
      ...propagationMap,
      downstreamImpacts: analysisType === 'upstream' || analysisType === 'coupling' ? [] : propagationMap.downstreamImpacts,
      upstreamDependencies: analysisType === 'downstream' || analysisType === 'coupling' ? [] : propagationMap.upstreamDependencies,
      couplingAnalysis: analysisType === 'downstream' || analysisType === 'upstream' ? [] : propagationMap.couplingAnalysis,
    };

    return { data: filtered };
  },
);
