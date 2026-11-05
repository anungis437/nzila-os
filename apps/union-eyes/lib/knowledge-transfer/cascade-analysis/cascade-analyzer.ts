/**
 * Cascade Analysis — Governance Failure Propagation
 *
 * Analyze how governance failures cascade through operations.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';

export interface GovernanceCascadeAnalysis {
  organizationId: string;
  generatedAt: string;
  /** Governance/compliance nodes in the org */
  governanceNodes: Array<{ id: string; label: string; criticality: 'high' | 'critical' }>;
  /** How governance failures cascade */
  cascadeRisks: Array<{
    governanceGap: string;
    impactedAreas: string[];
    severity: 'high' | 'critical';
    cascadeDepth: number;
  }>;
  /**
   * Areas that depend on a compliance node. No regulation, obligation or deadline is assessed: the entries state a dependency,
   * not a regulatory finding.
   */
  regulatoryRisks: string[];
  regulatoryAssessment: 'dependency_only_no_regulation_assessed';
  /** Recommendations: none are generated, since no analysis of the organization's procedures exists to base one on. */
  recommendations: string[];
}

export async function analyzeCascadeRisks(orgId: string): Promise<GovernanceCascadeAnalysis> {
  const propagationMap = await buildDependencyPropagationMap(orgId);

  const governanceNodes: GovernanceCascadeAnalysis['governanceNodes'] = propagationMap.nodes
    .filter((node) => node.category === 'governance' || node.category === 'compliance')
    .map((node) => ({
      id: node.id,
      label: node.label,
      criticality: node.continuitySensitivity === 'critical' ? 'critical' : 'high',
    }));

  const cascadeRisks = governanceNodes.map((gov) => {
    const impact = propagationMap.downstreamImpacts.find((downstreamImpact) => downstreamImpact.nodeId === gov.id);
    const severity = (gov.criticality === 'critical' ? 'critical' : 'high') as 'high' | 'critical';
    return {
      governanceGap: gov.label,
      impactedAreas: impact?.allAffectedNodes || [],
      severity,
      cascadeDepth: impact?.propagationPaths[0]?.chainDepth || 1,
    };
  });

  // Only what depends on a compliance node is listed; a governance node alone says nothing about a regulator.
  const complianceIds = new Set(propagationMap.nodes.filter((node) => node.category === 'compliance').map((node) => node.id));
  const regulatoryRisks = [
    ...new Set(
      governanceNodes
        .filter((gov) => complianceIds.has(gov.id))
        .flatMap((gov) => propagationMap.downstreamImpacts.find((impact) => impact.nodeId === gov.id)?.allAffectedNodes ?? []),
    ),
  ].map((area) => `Depends on a compliance node: ${area}`);

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    governanceNodes,
    cascadeRisks,
    regulatoryRisks,
    regulatoryAssessment: 'dependency_only_no_regulation_assessed',
    recommendations: [],
  };
}
