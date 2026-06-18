/**
 * Dependency Propagation Engine
 *
 * Traces continuity impact through organizational dependency chains.
 * Analyzes how removal of knowledge/systems/processes affects the organization.
 *
 * This is ORGANIZATIONAL ANALYSIS ONLY.
 * No employee evaluation, no labor analytics.
 *
 * INV-01: All AI calls via @nzila/ai-sdk getAiClient()
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import { buildTopicGraph } from '../topic-graph/topic-graph-builder';
import {
  type DependencyNode,
  type DependencyEdge,
  type PropagationMap,
  type DownstreamImpact,
  type UpstreamDependencies,
  type OperationalCouplingAnalysis,
  type PropagationPath,
  computeImpactScore,
  estimateRecoveryTime,
} from './propagation-models';

/**
 * Build organizational dependency graph from topic graph and expertise profiles.
 *
 * Approach:
 * 1. Load published interviews
 * 2. Extract topic graph (topics as nodes, co-occurrences as edges)
 * 3. Extract expertise profiles (expertise domains, systems ownership, etc.)
 * 4. Map dependencies:
 *    - If topic B appears in interviews with topic A, and topic A has lower frequency
 *    - Then B may depend on A
 * 5. Identify bottlenecks (single sources, high in-degree nodes)
 * 6. Compute impact scores and sensitivity levels
 */
export async function buildDependencyPropagationMap(orgId: string): Promise<PropagationMap> {
  // Load published interviews
  const interviews = await db
    .select({
      id: exitInterviews.id,
      roleInUnion: exitInterviews.roleInUnion,
      yearsOfService: exitInterviews.yearsOfService,
      topics: exitInterviews.topics,
      expertiseTags: exitInterviews.expertiseTags,
      summary: exitInterviews.summary,
    })
    .from(exitInterviews)
    .where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published')));

  if (interviews.length === 0) {
    return {
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      downstreamImpacts: [],
      upstreamDependencies: [],
      couplingAnalysis: [],
      bottlenecks: [],
      resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    };
  }

  // Build topic graph for foundational structure
  const topicGraph = await buildTopicGraph(orgId);

  // Build nodes from topics
  const nodes: DependencyNode[] = topicGraph.nodes.map((topic) => {
    const frequency = topic.frequency;
    const isSingleSource = frequency === 1;

    // Determine continuity sensitivity
    let sensitivity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reason = '';

    if (isSingleSource) {
      if (topic.category === 'governance' || topic.category === 'compliance') {
        sensitivity = 'critical';
        reason = `Sole expert in ${topic.category} area; loss would create compliance gap`;
      } else if (topic.category === 'system' || topic.category === 'vendor') {
        sensitivity = 'high';
        reason = `Single operator of critical system/vendor relationship`;
      } else {
        sensitivity = 'high';
        reason = `Single source of knowledge; undocumented risk`;
      }
    } else if (frequency === 2) {
      if (topic.category === 'governance' || topic.category === 'compliance') {
        sensitivity = 'high';
        reason = `Limited redundancy in critical governance function`;
      } else if (topic.category === 'system') {
        sensitivity = 'medium';
        reason = `System operated by limited number of people`;
      } else {
        sensitivity = 'medium';
        reason = `Knowledge concentrated in 2 sources`;
      }
    } else if (frequency <= 4) {
      if (topic.category === 'governance') {
        sensitivity = 'medium';
        reason = `Governance knowledge in limited circulation`;
      } else {
        sensitivity = 'medium';
        reason = `Knowledge distributed but not widely`;
      }
    } else {
      sensitivity = 'low';
      reason = `Knowledge reasonably distributed across multiple sources`;
    }

    return {
      id: topic.id,
      label: topic.label,
      nodeType: (
        topic.category === 'system' ? 'system' :
        topic.category === 'vendor' ? 'vendor' :
        topic.category === 'governance' ? 'governance' :
        'expertise'
      ) as DependencyNode['nodeType'],
      category: topic.category,
      frequency,
      associatedRoles: topic.contributingRoles,
      isSingleSource,
      continuitySensitivity: sensitivity,
      sensitivityReason: reason,
    };
  });

  // Build edges from topic co-occurrences
  const edges: DependencyEdge[] = topicGraph.edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) return null;

    // Heuristic: if source has lower frequency, target may depend on source
    // (i.e., target is more common knowledge that builds on source expertise)
    const dependsOn = sourceNode.frequency <= targetNode.frequency;

    let strength: 'weak' | 'medium' | 'strong' | 'critical' = 'weak';
    if (edge.weight >= 5) {
      strength = 'critical';
    } else if (edge.weight >= 4) {
      strength = 'strong';
    } else if (edge.weight >= 3) {
      strength = 'medium';
    }

    const depId = dependsOn ? targetNode.id : sourceNode.id;
    const depOnId = dependsOn ? sourceNode.id : targetNode.id;

    return {
      dependentId: depId,
      dependsOnId: depOnId,
      strength,
      evidenceCount: edge.weight,
      rationale: `Topics co-occur in ${edge.weight} interviews; indicates operational coupling`,
    };
  }).filter((edge): edge is DependencyEdge => edge !== null);

  // Identify bottlenecks
  const bottlenecks = nodes
    .filter((n) => n.isSingleSource || n.continuitySensitivity === 'critical')
    .map((n) => {
      return {
        nodeId: n.id,
        reason: (n.isSingleSource ? 'single_source' :
          n.category === 'vendor' ? 'critical_vendor' :
          n.category === 'governance' ? 'governance_concentration' :
          'high_dependents') as 'single_source' | 'high_dependents' | 'critical_vendor' | 'governance_concentration',
        riskLevel: n.continuitySensitivity === 'critical' ? 'critical' as const : 'high' as const,
        affectedRoles: n.associatedRoles,
      };
    });

  // Compute downstream impact for high-risk nodes
  const downstreamImpacts: DownstreamImpact[] = nodes
    .filter((n) => bottlenecks.some((b) => b.nodeId === n.id))
    .map((node) => computeDownstreamImpact(node, edges, nodes));

  // Compute upstream dependencies for critical nodes
  const upstreamDependencies: UpstreamDependencies[] = nodes
    .filter((n) => bottlenecks.some((b) => b.nodeId === n.id))
    .map((node) => computeUpstreamDependencies(node, edges, nodes));

  // Coupling analysis for critical nodes
  const couplingAnalysis: OperationalCouplingAnalysis[] = nodes
    .filter((n) => bottlenecks.some((b) => b.nodeId === n.id))
    .map((node) => computeOperationalCoupling(node, edges, nodes));

  // Resilience recommendations (AI-powered if available, else heuristic)
  const resilience = await computeResilienceRecommendations(
    orgId,
    bottlenecks,
    downstreamImpacts,
    nodes,
  );

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    downstreamImpacts,
    upstreamDependencies,
    couplingAnalysis,
    bottlenecks,
    resilience,
  };
}

function computeDownstreamImpact(
  node: DependencyNode,
  edges: DependencyEdge[],
  allNodes: DependencyNode[],
): DownstreamImpact {
  // Find direct dependents
  const directDependents = edges
    .filter((e) => e.dependsOnId === node.id)
    .map((e) => e.dependentId);

  // Transitive closure: all nodes affected
  const allAffected = new Set<string>();
  const queue = [...directDependents];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allAffected.has(current)) continue;
    allAffected.add(current);
    const nextDependents = edges
      .filter((e) => e.dependsOnId === current)
      .map((e) => e.dependentId);
    queue.push(...nextDependents);
  }

  // Find propagation paths (BFS)
  const propagationPaths = buildPropagationPaths(node, directDependents, edges, allNodes);

  // Compute exposure
  const exposureScore = computeImpactScore(
    node.frequency,
    allAffected.size,
    [...allAffected].map((id) => allNodes.find((n) => n.id === id)?.continuitySensitivity ?? 'low'),
    node.category === 'governance' || node.category === 'compliance',
  );

  // Governance exposure
  const governanceExposed = [...allAffected]
    .map((id) => allNodes.find((n) => n.id === id))
    .filter((n) => n?.category === 'governance' || n?.category === 'compliance')
    .map((n) => n?.label ?? '');

  // Vendor dependencies
  const vendorExposed = [...allAffected]
    .map((id) => allNodes.find((n) => n.id === id))
    .filter((n) => n?.category === 'vendor')
    .map((n) => n?.label ?? '');

  // Mitigation recommendations
  const priority =
    exposureScore >= 80 ? 'critical' :
    exposureScore >= 60 ? 'high' :
    'medium';

  const actions: string[] = [];
  if (node.isSingleSource) actions.push(`Document ${node.label} immediately`);
  if (governanceExposed.length > 0) actions.push(`Cross-train governance processes`);
  if (vendorExposed.length > 0) actions.push(`Establish vendor relationship redundancy`);
  if (propagationPaths.some((p) => p.chainDepth > 3)) {
    actions.push(`Simplify operational dependency chains`);
  }

  return {
    nodeId: node.id,
    directDependents,
    allAffectedNodes: [...allAffected],
    propagationPaths,
    totalExposureScore: exposureScore,
    governanceExposure: governanceExposed,
    vendorDependencyExposure: vendorExposed,
    mitigation: { priority, actions },
  };
}

function computeUpstreamDependencies(
  node: DependencyNode,
  edges: DependencyEdge[],
  allNodes: DependencyNode[],
): UpstreamDependencies {
  // Find direct dependencies (what this node depends on)
  const directDeps = edges
    .filter((e) => e.dependentId === node.id)
    .map((e) => e.dependsOnId);

  // Transitive closure
  const allRequired = new Set<string>();
  const queue = [...directDeps];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allRequired.has(current)) continue;
    allRequired.add(current);
    const nextDeps = edges
      .filter((e) => e.dependentId === current)
      .map((e) => e.dependsOnId);
    queue.push(...nextDeps);
  }

  // Check fragility of dependencies
  const depNodes = [...allRequired]
    .map((id) => allNodes.find((n) => n.id === id))
    .filter(Boolean) as DependencyNode[];

  const singleSourceDeps = depNodes.filter((d) => d.isSingleSource).map((d) => d.id);
  const criticalDeps = depNodes.filter((d) => d.continuitySensitivity === 'critical').length;
  const highDeps = depNodes.filter((d) => d.continuitySensitivity === 'high').length;

  let fragility: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (singleSourceDeps.length > 0 && depNodes.length <= 3) {
    fragility = 'critical';
  } else if (criticalDeps > 0) {
    fragility = 'high';
  } else if (highDeps > 1) {
    fragility = 'medium';
  }

  const complexityScore = Math.min(depNodes.length * 15 + singleSourceDeps.length * 25, 100);

  return {
    nodeId: node.id,
    directDependencies: directDeps,
    allRequiredDependencies: [...allRequired],
    dependencyFragility: fragility,
    singleSourceDependencies: singleSourceDeps,
    complexityScore,
  };
}

function computeOperationalCoupling(
  node: DependencyNode,
  edges: DependencyEdge[],
  allNodes: DependencyNode[],
): OperationalCouplingAnalysis {
  // Find nodes with strong/critical edges
  const coupledEdges = edges.filter(
    (e) => (e.dependentId === node.id || e.dependsOnId === node.id)
  );

  const tightlyCoupled = coupledEdges
    .filter((e) => e.strength === 'critical' || e.strength === 'strong')
    .map((e) => ({
      nodeId: e.dependentId === node.id ? e.dependsOnId : e.dependentId,
      couplingStrength: e.strength === 'critical' ? 1.0 : 0.8,
    }));

  const looselyCoupled = coupledEdges
    .filter((e) => e.strength === 'weak' || e.strength === 'medium')
    .map((e) => ({
      nodeId: e.dependentId === node.id ? e.dependsOnId : e.dependentId,
      couplingStrength: e.strength === 'medium' ? 0.5 : 0.2,
    }));

  // Critical dependents: those with high sensitivity
  const criticalDependents = edges
    .filter((e) => e.dependsOnId === node.id)
    .map((e) => e.dependentId)
    .filter((id) => {
      const depNode = allNodes.find((n) => n.id === id);
      return depNode && (depNode.continuitySensitivity === 'critical' || depNode.continuitySensitivity === 'high');
    });

  // Isolation score: fewer connections = more isolated
  const connectionCount = coupledEdges.length;
  const isolationScore = Math.max(0, 100 - connectionCount * 15);

  // Cohesion score: how well integrated (inverse of isolation)
  const cohesionScore = 100 - isolationScore;

  return {
    nodeId: node.id,
    tightlyCoupledNodes: tightlyCoupled,
    looselyCoupledNodes: looselyCoupled,
    criticalDependents,
    isolationScore,
    cohesionScore,
  };
}

function buildPropagationPaths(
  originNode: DependencyNode,
  directDependents: string[],
  edges: DependencyEdge[],
  allNodes: DependencyNode[],
) {
  const paths: PropagationPath[] = [];
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[] }> = directDependents.map((id) => ({
    nodeId: id,
    path: [originNode.id, id],
  }));

  while (queue.length > 0 && paths.length < 10) {
    const { nodeId, path } = queue.shift()!;
    if (visited.has(nodeId) || path.length > 6) continue;
    visited.add(nodeId);

    const node = allNodes.find((n) => n.id === nodeId);
    const impactScore = computeImpactScore(
      node?.frequency ?? 1,
      edges.filter((e) => e.dependsOnId === nodeId).length,
      edges
        .filter((e) => e.dependsOnId === nodeId)
        .map((e) => {
          const dep = allNodes.find((n) => n.id === e.dependentId);
          return dep?.continuitySensitivity ?? 'low';
        }),
      node?.category === 'governance',
    );

    const disruptionScope = (
      impactScore >= 80 ? 'critical' :
      impactScore >= 60 ? 'organizational' :
      impactScore >= 40 ? 'local' :
      'isolated'
    ) as 'isolated' | 'local' | 'organizational' | 'critical';

    paths.push({
      originId: originNode.id,
      chainPath: path,
      impactScore,
      disruptionScope,
      recoveryTimeWeeks: estimateRecoveryTime(
        path.length,
        path.some((id) => allNodes.find((n) => n.id === id)?.category === 'vendor'),
        path.some((id) => allNodes.find((n) => n.id === id)?.category === 'governance'),
        'partial',
      ),
      affectedRoles: path.flatMap((id) => allNodes.find((n) => n.id === id)?.associatedRoles ?? []),
      chainDepth: path.length,
    });

    // Add next dependents to queue
    const nextDependents = edges
      .filter((e) => e.dependsOnId === nodeId)
      .map((e) => e.dependentId);
    for (const next of nextDependents) {
      queue.push({ nodeId: next, path: [...path, next] });
    }
  }

  return paths;
}

async function computeResilienceRecommendations(
  orgId: string,
  bottlenecks: Array<{
    nodeId: string;
    reason: 'single_source' | 'high_dependents' | 'critical_vendor' | 'governance_concentration';
    riskLevel: 'high' | 'critical';
    affectedRoles: string[];
  }>,
  downstreamImpacts: DownstreamImpact[],
  nodes: DependencyNode[],
) {
  const recommendations: string[] = [];
  const priorityOrder: string[] = [];
  const effort: Record<string, 'low' | 'medium' | 'high'> = {};

  // Heuristic recommendations (AI can enhance in future)
  for (const impact of downstreamImpacts) {
    const node = nodes.find((n) => n.id === impact.nodeId);
    if (!node) continue;

    if (node.isSingleSource) {
      recommendations.push(
        `Document and cross-train "${node.label}" — currently held by single source`
      );
      priorityOrder.push(node.id);
      effort[node.id] = 'medium';
    }

    if (impact.governanceExposure.length > 0) {
      recommendations.push(
        `Establish redundancy in governance functions: ${impact.governanceExposure.join(', ')}`
      );
      effort[`gov_${node.id}`] = 'high';
    }

    if (impact.vendorDependencyExposure.length > 0) {
      recommendations.push(
        `Diversify vendor relationships: ${impact.vendorDependencyExposure.join(', ')}`
      );
      effort[`vendor_${node.id}`] = 'high';
    }
  }

  return {
    recommendations,
    priorityOrder: priorityOrder.slice(0, 5),
    estimatedEffort: effort,
  };
}
