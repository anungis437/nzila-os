/**
 * Cascade Analysis — Governance Failure Propagation
 *
 * Analyze how governance failures cascade through operations.
 */

import { loadGraphEvidence, evidenceBasisForNode, GRAPH_EVIDENCE_METHODOLOGY_NOTE, type EvidenceBasis } from '../propagation/graph-evidence-service';

export interface GovernanceCascadeAnalysis {
  organizationId: string;
  generatedAt: string;
  /** See GRAPH_EVIDENCE_METHODOLOGY_NOTE: every per-item evidenceBasis below says whether that specific item is
   *  backed by a currently-verified dependency record or is exploratory-only (inferred from tag co-occurrence). */
  methodologyNote: string;
  /** Governance/compliance nodes in the org */
  governanceNodes: Array<{ id: string; label: string; criticality: 'high' | 'critical'; evidenceBasis: EvidenceBasis }>;
  /** How governance failures cascade */
  cascadeRisks: Array<{
    governanceGap: string;
    impactedAreas: string[];
    severity: 'high' | 'critical';
    cascadeDepth: number;
    evidenceBasis: EvidenceBasis;
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
  const evidence = await loadGraphEvidence(orgId);
  const propagationMap = evidence.exploratory;

  const governanceNodes: GovernanceCascadeAnalysis['governanceNodes'] = propagationMap.nodes
    .filter((node) => node.category === 'governance' || node.category === 'compliance')
    .map((node) => ({
      id: node.id,
      label: node.label,
      criticality: node.continuitySensitivity === 'critical' ? 'critical' : 'high',
      evidenceBasis: evidenceBasisForNode(evidence, node.id),
    }));

  const cascadeRisks = governanceNodes.map((gov) => {
    const impact = propagationMap.downstreamImpacts.find((downstreamImpact) => downstreamImpact.nodeId === gov.id);
    const severity = (gov.criticality === 'critical' ? 'critical' : 'high') as 'high' | 'critical';
    return {
      governanceGap: gov.label,
      impactedAreas: impact?.allAffectedNodes || [],
      severity,
      cascadeDepth: impact?.propagationPaths[0]?.chainDepth || 1,
      evidenceBasis: gov.evidenceBasis,
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
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    governanceNodes,
    cascadeRisks,
    regulatoryRisks,
    regulatoryAssessment: 'dependency_only_no_regulation_assessed',
    recommendations: [],
  };
}
