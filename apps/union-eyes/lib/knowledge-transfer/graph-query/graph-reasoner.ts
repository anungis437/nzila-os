/**
 * Organizational Graph Reasoner
 *
 * Executes explainable queries over the organizational dependency graph.
 * Enables discovering patterns: isolated knowledge, bottlenecks, fragility, risks.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import type { GraphQuery, QueryResult, QueryFinding } from './query-models';
import type { DependencyNode, DependencyEdge } from '../propagation/propagation-models';

export async function executeGraphQuery(orgId: string, query: GraphQuery): Promise<QueryResult> {
  // Build the dependency graph
  const propagationMap = await buildDependencyPropagationMap(orgId);

  let findings: QueryFinding[] = [];
  let summary = '';
  let significance = '';
  let recommendations: string[] = [];

  switch (query.queryType) {
    case 'isolated_knowledge':
      ({ findings, summary, significance, recommendations } = queryIsolatedKnowledge(propagationMap, query));
      break;
    case 'continuity_bottlenecks':
      ({ findings, summary, significance, recommendations } = queryContinuityBottlenecks(propagationMap, query));
      break;
    case 'governance_dependencies':
      ({ findings, summary, significance, recommendations } = queryGovernanceDependencies(propagationMap, query));
      break;
    case 'fragile_operations':
      ({ findings, summary, significance, recommendations } = queryFragileOperations(propagationMap, query));
      break;
    case 'vendor_concentration':
      ({ findings, summary, significance, recommendations } = queryVendorConcentration(propagationMap, query));
      break;
    case 'undocumented_chains':
      ({ findings, summary, significance, recommendations } = queryUndocumentedChains(propagationMap, query));
      break;
    case 'propagation_paths':
      ({ findings, summary, significance, recommendations } = queryPropagationPaths(propagationMap, query));
      break;
    case 'resilience_weaknesses':
      ({ findings, summary, significance, recommendations } = queryResilienceWeaknesses(propagationMap, query));
      break;
    case 'knowledge_redundancy':
      ({ findings, summary, significance, recommendations } = queryKnowledgeRedundancy(propagationMap, query));
      break;
  }

  const confidenceScore = calculateConfidenceScore(propagationMap, findings);

  return {
    organizationId: orgId,
    executedAt: new Date().toISOString(),
    query,
    summary,
    findings,
    significance,
    recommendations,
    confidenceScore,
  };
}

function queryIsolatedKnowledge(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const isolatedNodes = propagationMap.nodes.filter((n: any) => n.isSingleSource);

  if (query.filters?.minimumRiskLevel) {
    const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    isolatedNodes.filter((n: any) => {
      const nodeRisk = riskOrder[n.continuitySensitivity as keyof typeof riskOrder] ?? 0;
      const filterRisk = riskOrder[query.filters!.minimumRiskLevel as keyof typeof riskOrder] ?? 0;
      return nodeRisk >= filterRisk;
    });
  }

  const findings: QueryFinding[] = isolatedNodes.map((node: any) => ({
    entityId: node.id,
    label: node.label,
    entityType: 'node',
    significance: `Sole source of knowledge in ${node.category}; if unavailable, this knowledge is lost to the organization`,
    riskLevel: node.continuitySensitivity,
    affectedAreas: node.associatedRoles,
    mitigation: `Immediately document and cross-train: ${node.label}`,
    evidenceChain: [
      `Knowledge mentioned in exactly 1 interview (${node.associatedRoles[0] || 'unknown role'})`,
      `Category: ${node.category}`,
      `No redundancy available in organizational memory`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} isolated knowledge area(s). Each represents a single point of failure.`,
    significance: 'Isolated knowledge creates acute continuity risk. Loss of any single expert means permanent loss of that institutional knowledge.',
    recommendations: [
      'Schedule immediate knowledge transfer sessions with each isolated knowledge holder',
      'Create documentation and runbooks for all isolated areas',
      'Consider cross-training to create redundancy',
      'Prioritize governance and compliance areas first',
    ],
  };
}

function queryContinuityBottlenecks(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const bottlenecks = propagationMap.bottlenecks.map((b: any) => {
    const node = propagationMap.nodes.find((n: any) => n.id === b.nodeId);
    const impact = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === b.nodeId);
    return { ...b, node, impact };
  });

  const findings: QueryFinding[] = bottlenecks.map((b: any) => ({
    entityId: b.nodeId,
    label: b.node?.label || 'unknown',
    entityType: 'node',
    significance: `Critical continuity bottleneck: ${b.impact?.allAffectedNodes.length || 0} processes depend on this. If lost, ${b.impact?.totalExposureScore || 0}% of operations affected.`,
    riskLevel: 'critical',
    affectedAreas: b.affectedRoles,
    mitigation: b.node?.category === 'vendor' ? 'Establish alternative vendor relationships' : 'Document and cross-train',
    evidenceChain: [
      `Reason: ${b.reason}`,
      `Directly affects: ${b.impact?.directDependents.length || 0} processes`,
      `Transitively affects: ${b.impact?.allAffectedNodes.length || 0} operational areas`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} critical continuity bottleneck(s). These are high-leverage resilience targets.`,
    significance: 'Bottlenecks are organizational chokepoints where knowledge/system/vendor loss would cascade through operations.',
    recommendations: [
      'Map dependency chains for each bottleneck',
      'Identify and implement workarounds or alternatives',
      'Create mitigation playbooks for each bottleneck',
      'Consider distributed/decentralized redesigns',
    ],
  };
}

function queryGovernanceDependencies(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const governanceNodes = propagationMap.nodes.filter(
    (n: any) => n.category === 'governance' || n.category === 'compliance',
  );

  const findings: QueryFinding[] = governanceNodes.map((node: any) => ({
    entityId: node.id,
    label: node.label,
    entityType: 'node',
    significance: `Governance/compliance knowledge: ${node.isSingleSource ? 'held by single source' : 'distributed across ' + node.associatedRoles.length + ' roles'}. Regulatory obligations at risk if unavailable.`,
    riskLevel: node.continuitySensitivity,
    affectedAreas: node.associatedRoles,
    mitigation: 'Ensure governance procedures are formally documented and tested',
    evidenceChain: [
      `Governance criticality: ${node.continuitySensitivity}`,
      `Knowledge holders: ${node.associatedRoles.join(', ')}`,
      `Formality level: ${node.isSingleSource ? 'informal/undocumented' : 'somewhat distributed'}`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} governance/compliance knowledge area(s). These carry regulatory obligations.`,
    significance: 'Governance failures can create legal liability. Informal governance knowledge is particularly risky.',
    recommendations: [
      'Audit all governance procedures for formality and documentation',
      'Cross-train on compliance areas',
      'Create governance playbooks for regulatory bodies',
      'Establish governance knowledge as continuously maintained',
    ],
  };
}

function queryFragileOperations(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const fragileNodes = propagationMap.nodes.filter(
    (n: any) => n.continuitySensitivity === 'critical' || n.continuitySensitivity === 'high',
  );

  const findings: QueryFinding[] = fragileNodes.map((node: any) => ({
    entityId: node.id,
    label: node.label,
    entityType: 'node',
    significance: `Operational fragility: ${node.label} is ${node.isSingleSource ? 'sole-sourced' : 'distributed but thinly'} and critical to organizational continuity.`,
    riskLevel: node.continuitySensitivity,
    affectedAreas: node.associatedRoles,
    mitigation: 'Increase redundancy and documentation immediately',
    evidenceChain: [
      `Frequency: mentioned in ${node.frequency} interview(s)`,
      `Sensitivity rating: ${node.continuitySensitivity}`,
      `Reason: ${node.sensitivityReason}`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} operational fragility point(s). Organization would struggle to maintain operations if these were lost.`,
    significance: 'Fragility is the difference between stable operations and crisis.',
    recommendations: [
      'Immediately assess recovery capability for each fragile area',
      'Develop mitigation playbooks',
      'Consider system redesign to reduce fragility',
      'Budget for redundancy investments',
    ],
  };
}

function queryVendorConcentration(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const vendorNodes = propagationMap.nodes.filter((n: any) => n.category === 'vendor');

  const findings: QueryFinding[] = vendorNodes.map((node: any) => {
    const impact = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === node.id);
    return {
      entityId: node.id,
      label: node.label,
      entityType: 'node',
      significance: `Vendor concentration risk: ${node.label} is ${node.isSingleSource ? 'the sole vendor' : 'one of few vendors'} for ${impact?.allAffectedNodes.length || 'critical'} operational areas.`,
      riskLevel: node.continuitySensitivity,
      affectedAreas: impact?.allAffectedNodes || [],
      mitigation: 'Establish alternative vendor relationships and SLAs',
      evidenceChain: [
        `Vendor relationships: ${node.frequency} internal processes depend`,
        `Switching options: ${node.isSingleSource ? 'very limited' : 'may exist'}`,
        `Single point of failure: ${node.isSingleSource}`,
      ],
    };
  });

  return {
    findings,
    summary: `Found ${findings.length} vendor concentration risk(s). Vendor disruption could compromise operations.`,
    significance: 'Vendor concentration creates external continuity risk. Vendor failure or relationship termination would cascade internally.',
    recommendations: [
      'Diversify critical vendor relationships',
      'Establish vendor redundancy for critical functions',
      'Review vendor contracts for continuity clauses',
      'Create vendor switching playbooks',
    ],
  };
}

function queryUndocumentedChains(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  // Approximation: find single-source nodes and their propagation chains
  const undocumentedChains = propagationMap.nodes
    .filter((n: any) => n.isSingleSource)
    .map((node: any) => {
      const impact = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === node.id);
      return {
        chainId: `chain_${node.id}`,
        label: `Undocumented workflow involving ${node.label}`,
        nodes: [node, ...(impact?.allAffectedNodes || [])],
        riskLevel: node.continuitySensitivity,
      };
    });

  const findings: QueryFinding[] = undocumentedChains.map((chain: any) => ({
    entityId: chain.chainId,
    label: chain.label,
    entityType: 'chain',
    significance: 'Undocumented workflow chain: if key person leaves, entire process sequence could be lost.',
    riskLevel: chain.riskLevel,
    affectedAreas: chain.nodes.flatMap((n: any) => n.associatedRoles),
    mitigation: 'Immediately document all steps in this workflow',
    evidenceChain: [
      `Chain length: ${chain.nodes.length} connected steps`,
      `Single source: the first step is only known to one person`,
      `Documentation status: unknown/likely informal`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} undocumented workflow chain(s). These represent knowledge at highest risk.`,
    significance: "Undocumented chains are institutional knowledge that exists only in people's heads. Loss would require complete relearning.",
    recommendations: [
      'Document workflows end-to-end',
      'Create process flowcharts and runbooks',
      'Test documentation by training someone new',
      'Establish documentation as ongoing responsibility',
    ],
  };
}

function queryPropagationPaths(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  // Collect all propagation paths from downstream impacts
  const allPaths = propagationMap.downstreamImpacts.flatMap((impact: any) => impact.propagationPaths);

  const findings: QueryFinding[] = allPaths.slice(0, 10).map((path: any) => ({
    entityId: `path_${path.chainPath.join('_')}`,
    label: `Propagation chain (${path.chainDepth} steps, impact: ${path.disruptionScope})`,
    entityType: 'path',
    significance: `If first node fails, failure cascades through ${path.chainDepth} intermediate steps to affect: ${path.affectedRoles.join(', ')}`,
    riskLevel: path.disruptionScope === 'critical' ? 'critical' : path.disruptionScope === 'organizational' ? 'high' : 'medium',
    affectedAreas: path.affectedRoles,
    mitigation: `Simplify this chain or establish breakpoints to prevent cascade`,
    evidenceChain: [
      `Chain length: ${path.chainDepth} nodes`,
      `Recovery time if chain breaks: ${path.recoveryTimeWeeks} weeks`,
      `Affected roles: ${path.affectedRoles.join(', ')}`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} propagation path(s) where failure cascades. Longest chain: ${allPaths.reduce((max: any, p: any) => Math.max(max, p.chainDepth), 0)} steps.`,
    significance: 'Propagation paths show how isolated failures become organizational crises. Long chains mean crisis amplification.',
    recommendations: [
      'Map all propagation paths for critical nodes',
      'Add "circuit breakers" to stop cascade',
      'Establish independent fallback procedures at key points',
      'Test failure scenarios along longest paths',
    ],
  };
}

function queryResilienceWeaknesses(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const findings: QueryFinding[] = propagationMap.bottlenecks.map((b: any) => ({
    entityId: b.nodeId,
    label: b.nodeId,
    entityType: 'node',
    significance: `Resilience weakness: ${b.reason}. Exposes organization to ${b.riskLevel} continuity impact.`,
    riskLevel: b.riskLevel,
    affectedAreas: b.affectedRoles,
    mitigation: 'Address through redundancy, documentation, or system redesign',
    evidenceChain: [
      `Weakness type: ${b.reason}`,
      `Risk level: ${b.riskLevel}`,
      `Affected roles: ${b.affectedRoles.join(', ')}`,
    ],
  }));

  return {
    findings,
    summary: `Found ${findings.length} resilience weakness(es). Organization has ${findings.filter((f) => f.riskLevel === 'critical').length} critical weaknesses.`,
    significance: 'Resilience weaknesses are where organizational continuity is fragile. Addressing them is the path to robustness.',
    recommendations: [
      'Prioritize remediating critical resilience weaknesses',
      'Create multi-year resilience improvement roadmap',
      'Budget for documentation and redundancy',
      'Establish resilience metrics and monitoring',
    ],
  };
}

function queryKnowledgeRedundancy(
  propagationMap: any,
  query: GraphQuery,
): {
  findings: QueryFinding[];
  summary: string;
  significance: string;
  recommendations: string[];
} {
  const wellCovered = propagationMap.nodes.filter((n: any) => n.frequency >= 4).length;
  const atRisk = propagationMap.nodes.filter((n: any) => n.frequency === 1).length;

  const findings: QueryFinding[] = [
    {
      entityId: 'redundancy_summary',
      label: 'Knowledge Redundancy Overview',
      entityType: 'cluster',
      significance: `${wellCovered} well-covered areas vs ${atRisk} single-source areas. Redundancy score: ${Math.round(100 - (atRisk / propagationMap.nodes.length) * 100)}%`,
      riskLevel: 'medium',
      affectedAreas: [],
      evidenceChain: [
        `Total knowledge areas: ${propagationMap.nodes.length}`,
        `Well-covered (3+ sources): ${wellCovered}`,
        `At-risk single-source: ${atRisk}`,
        `Average coverage: ${(propagationMap.nodes.reduce((sum: any, n: any) => sum + n.frequency, 0) / propagationMap.nodes.length).toFixed(1)} interviews`,
      ],
    },
  ];

  return {
    findings,
    summary: 'Knowledge redundancy analysis shows distribution of institutional knowledge across the organization.',
    significance: 'High redundancy = organization resilient to personnel changes. Low redundancy = organization brittle.',
    recommendations: [
      'Target: achieve 3+ sources for all critical knowledge',
      'Prioritize documenting single-source areas',
      'Create cross-training program for at-risk areas',
      'Establish knowledge management system',
    ],
  };
}

function calculateConfidenceScore(propagationMap: any, findings: QueryFinding[]): number {
  // Confidence based on data quality
  const interviewCount = propagationMap.nodes.reduce((sum: any, n: any) => sum + n.frequency, 0);
  let confidence = Math.min(interviewCount * 10, 80); // Max 80% without additional validation

  if (findings.length > 0) confidence += 10; // More findings = more confidence
  if (propagationMap.bottlenecks.length > 0) confidence += 10; // Clear structures increase confidence

  return Math.min(confidence, 100);
}
