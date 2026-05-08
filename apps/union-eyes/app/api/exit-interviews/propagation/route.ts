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

import { withApi } from '@/lib/api/framework';
import { buildDependencyPropagationMap } from '@/lib/knowledge-transfer/propagation';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId, request }) => {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const analysisType = searchParams.get('analysisType') || 'full';

    const propagationMap = await buildDependencyPropagationMap(organizationId!);

    if (!propagationMap.nodes.length) {
      return {
        data: propagationMap,
        meta: { message: 'No published interviews found to analyze' },
      };
    }

    // Filter to specific node if requested
    if (nodeId) {
      const node = propagationMap.nodes.find((n: any) => n.id === nodeId);
      if (!node) {
        throw new Error('Node not found');
      }

      const downstreamImpact = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === nodeId);
      const upstreamDeps = propagationMap.upstreamDependencies.find((u: any) => u.nodeId === nodeId);
      const coupling = propagationMap.couplingAnalysis.find((c: any) => c.nodeId === nodeId);

      return {
        data: {
          node,
          downstreamImpact,
          upstreamDependencies: upstreamDeps,
          couplingAnalysis: coupling,
        },
      };
    }

    // Return full map, potentially filtered by analysis type
    const filtered = {
      ...propagationMap,
      downstreamImpacts: analysisType === 'upstream' ? [] : propagationMap.downstreamImpacts,
      upstreamDependencies: analysisType === 'downstream' ? [] : propagationMap.upstreamDependencies,
    };

    return { data: filtered };
  },
);
