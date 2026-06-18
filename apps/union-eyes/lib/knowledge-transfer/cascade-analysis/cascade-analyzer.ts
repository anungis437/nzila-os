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
  /** Regulatory continuity risks */
  regulatoryRisks: string[];
  /** Recommendations */
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

  const regulatoryRisks = [
    ...new Set(cascadeRisks.flatMap((risk) => risk.impactedAreas)),
  ].map((area) => `Regulatory continuity risk: ${area}`);

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    governanceNodes,
    cascadeRisks,
    regulatoryRisks,
    recommendations: [
      'Formalize all governance procedures',
      'Create governance playbooks for regulatory bodies',
      'Establish governance knowledge redundancy',
    ],
  };
}
