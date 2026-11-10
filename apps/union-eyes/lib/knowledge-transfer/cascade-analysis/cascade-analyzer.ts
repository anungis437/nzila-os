/**
 * Cascade Analysis — Governance Failure Propagation
 *
 * Analyze how governance failures cascade through operations. The cascade itself is inferred from the exploratory
 * graph. A cascade is CONFIRMED only for the impacted areas a failure of the governance node reaches through a chain
 * of currently-verified, correctly-directed dependencies (verifiedImpactChains). A verified record that merely
 * involves the governance node confirms nothing, and severity (from inferred continuity sensitivity) is never
 * confirmed by dependency evidence: it stays a hypothesis even on a confirmed cascade.
 */

import {
  loadGraphEvidence,
  verifiedImpactChains,
  GRAPH_EVIDENCE_METHODOLOGY_NOTE,
  type EvidenceBasis,
  type ConfirmedEdge,
} from '../propagation/graph-evidence-service';

export interface ConfirmedImpactedArea {
  nodeId: string;
  /** Governance node first; each next node verifiably depends on the previous one. */
  chain: string[];
  /** Weakest evidence tier along the chain. */
  evidenceTier: ConfirmedEdge['evidenceTier'];
  verifiedBy: ConfirmedEdge[];
}

export interface GovernanceCascadeAnalysis {
  organizationId: string;
  generatedAt: string;
  /** See GRAPH_EVIDENCE_METHODOLOGY_NOTE: every per-item evidenceBasis below says whether that specific item is
   *  backed by a currently-verified dependency record or is exploratory-only (inferred from tag co-occurrence). */
  methodologyNote: string;
  /** Governance/compliance nodes in the org. Their classification and criticality come from the inferred graph, so
   *  evidenceBasis is always 'exploratory': verified dependency evidence confirms relationships, not node properties. */
  governanceNodes: Array<{ id: string; label: string; criticality: 'high' | 'critical'; evidenceBasis: 'exploratory' }>;
  /** How governance failures cascade */
  cascadeRisks: Array<{
    governanceGap: string;
    /** Governance node id the cascade starts from. */
    governanceNodeId: string;
    impactedAreas: string[];
    /** Inferred from continuity sensitivity. Never confirmed by dependency evidence. */
    severity: 'high' | 'critical';
    severityBasis: 'exploratory';
    cascadeDepth: number;
    /** 'verified' when at least one impacted area is reached through a fully verified directed chain. */
    evidenceBasis: EvidenceBasis;
    /** The impacted areas reached through a fully verified directed chain, each with its chain and evidence. */
    confirmedImpactedAreas: ConfirmedImpactedArea[];
  }>;
  /** Cascade risks reduced to what is CONFIRMED: impactedAreas holds only the confirmed areas and cascadeDepth the
   *  longest confirmed chain. The only entries an API response, calculation or UI may present as a confirmed cascade -
   *  and even here severity is a hypothesis (severityBasis 'exploratory'). */
  confirmedCascadeRisks: GovernanceCascadeAnalysis['cascadeRisks'];
  /** The unconfirmed remainder of every cascade: impactedAreas holds the areas NOT reached by a verified chain. A
   *  hypothesis from tag co-occurrence, kept available as discovery signal, never silently dropped or suppressed. */
  exploratoryCascadeHypotheses: GovernanceCascadeAnalysis['cascadeRisks'];
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
      evidenceBasis: 'exploratory' as const,
    }));

  const cascadeRisks: GovernanceCascadeAnalysis['cascadeRisks'] = governanceNodes.map((gov) => {
    const impact = propagationMap.downstreamImpacts.find((downstreamImpact) => downstreamImpact.nodeId === gov.id);
    const severity = (gov.criticality === 'critical' ? 'critical' : 'high') as 'high' | 'critical';
    const chains = verifiedImpactChains(evidence, gov.id);
    const confirmedImpactedAreas: ConfirmedImpactedArea[] = [...chains.entries()].map(([nodeId, { chain, assessment }]) => ({
      nodeId,
      chain,
      evidenceTier: assessment.evidenceTier,
      verifiedBy: assessment.verifiedBy,
    }));
    return {
      governanceGap: gov.label,
      governanceNodeId: gov.id,
      impactedAreas: impact?.allAffectedNodes || [],
      severity,
      severityBasis: 'exploratory',
      cascadeDepth: impact?.propagationPaths[0]?.chainDepth || 1,
      evidenceBasis: confirmedImpactedAreas.length > 0 ? 'verified' : 'exploratory',
      confirmedImpactedAreas,
    };
  });
  const confirmedCascadeRisks = cascadeRisks
    .filter((risk) => risk.confirmedImpactedAreas.length > 0)
    .map((risk) => ({
      ...risk,
      impactedAreas: risk.confirmedImpactedAreas.map((area) => area.nodeId),
      cascadeDepth: Math.max(...risk.confirmedImpactedAreas.map((area) => area.chain.length)),
    }));

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
    confirmedCascadeRisks,
    exploratoryCascadeHypotheses: cascadeRisks
      .map((risk) => {
        const confirmed = new Set(risk.confirmedImpactedAreas.map((area) => area.nodeId));
        return { ...risk, evidenceBasis: 'exploratory' as const, impactedAreas: risk.impactedAreas.filter((id) => !confirmed.has(id)), confirmedImpactedAreas: [] };
      })
      .filter((risk) => risk.impactedAreas.length > 0 || risk.confirmedImpactedAreas.length === 0),
    regulatoryRisks,
    regulatoryAssessment: 'dependency_only_no_regulation_assessed',
    recommendations: [],
  };
}
