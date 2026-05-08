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

  const governanceNodes = propagationMap.nodes
    .filter((n: any) => n.category === 'governance' || n.category === 'compliance')
    .map((n: any) => ({ id: n.id, label: n.label, criticality: n.continuitySensitivity }));

  const cascadeRisks = governanceNodes.map((gov: any) => {
    const impact = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === gov.id);
    const severity = (gov.criticality === 'critical' ? 'critical' : 'high') as 'high' | 'critical';
    return {
      governanceGap: gov.label,
      impactedAreas: impact?.allAffectedNodes || [],
      severity,
      cascadeDepth: impact?.propagationPaths[0]?.chainDepth || 1,
    };
  });

  const regulatoryRisks = [
    ...new Set(cascadeRisks.flatMap((c: any) => c.impactedAreas)),
  ].map((area: any) => `Regulatory continuity risk: ${area}`);

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
