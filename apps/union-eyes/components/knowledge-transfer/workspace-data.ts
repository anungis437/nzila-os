/**
 * What the continuity simulation workspace shows, taken from what the routes answer (UE-CONV-H-027).
 *
 * Every function takes the service's own result type, so a field the screen reads that the service does not return is a type error here, not a panel that is quietly
 * empty. Where the service says nothing the screen says nothing either: a value the answer lacks is left out, never filled in with a plausible default.
 */
import type { GovernanceCascadeAnalysis } from '@/lib/knowledge-transfer/cascade-analysis/cascade-analyzer';
import type { MitigationComparison, MitigationScenario, MitigationType } from '@/lib/knowledge-transfer/mitigation-comparison/mitigation-models';
import type { PropagationMap } from '@/lib/knowledge-transfer/propagation/propagation-models';
import type { ContinuitySimulationResult, SimulationType } from '@/lib/knowledge-transfer/simulation/simulation-models';
import type { CognitionGraph, CognitionNode } from './cognition-graph/cognition-graph-viz';
import type { GovernanceImpactData } from './governance-impact/governance-impact-explorer';
import type { PropagationPlaybackData } from './propagation-playback/propagation-playback';

/** The width the graph draws a dependency with. */
const EDGE_WIDTH = { weak: 1, medium: 2, strong: 3, critical: 4 } as const;

/** The nodes the cascade analysis treats as governance: governance and compliance knowledge. */
const isGovernanceNode = (node: { category: string }): boolean => node.category === 'governance' || node.category === 'compliance';

const idsOf = (nodes: CognitionNode[]): string[] => nodes.map((node) => node.id);

export function toCognitionGraph(map: PropagationMap): CognitionGraph {
  const governanceIds = new Set(map.nodes.filter(isGovernanceNode).map((node) => node.id));
  return {
    nodes: map.nodes.map(({ id, label, nodeType, category, continuitySensitivity, isSingleSource, frequency }) => ({ id, label, nodeType, category, continuitySensitivity, isSingleSource, frequency })),
    edges: map.edges.map((edge) => ({
      sourceId: edge.dependentId,
      targetId: edge.dependsOnId,
      strength: EDGE_WIDTH[edge.strength],
      edgeType: governanceIds.has(edge.dependentId) || governanceIds.has(edge.dependsOnId) ? 'governance' : 'dependency',
    })),
    propagationPaths: map.downstreamImpacts.flatMap((impact) => impact.propagationPaths.map((path) => ({ path: path.chainPath, impactScore: path.impactScore, disruptionScope: path.disruptionScope }))),
    bottlenecks: map.bottlenecks.map((bottleneck) => bottleneck.nodeId),
  };
}

export interface SimulationPreset {
  id: string;
  label: string;
  simulationType: SimulationType;
  /** The nodes of the graph this disruption would reach. A simulation that reaches none says nothing about resilience, so the service refuses it. */
  affected: (graph: CognitionGraph) => string[];
  /** Why the preset cannot be run when there is no node for it. */
  noneReason: string;
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  { id: 'retirement_wave', label: 'Retirement Wave', simulationType: 'retirement', affected: (graph) => idsOf(graph.nodes.filter((node) => node.isSingleSource)), noneReason: 'No knowledge area rests on a single source.' },
  { id: 'rapid_turnover', label: 'Rapid Turnover', simulationType: 'sudden_departure', affected: (graph) => [...graph.bottlenecks], noneReason: 'No bottleneck was found.' },
  { id: 'governance_transition', label: 'Governance Transition', simulationType: 'governance_knowledge_loss', affected: (graph) => idsOf(graph.nodes.filter(isGovernanceNode)), noneReason: 'No governance or compliance knowledge is recorded.' },
  { id: 'vendor_disruption', label: 'Vendor Disruption', simulationType: 'vendor_loss', affected: (graph) => idsOf(graph.nodes.filter((node) => node.nodeType === 'vendor')), noneReason: 'No vendor dependency is recorded.' },
];

export function toPlayback(result: ContinuitySimulationResult, label: string): PropagationPlaybackData {
  const timeline = result.degradationTimeline.map((point) => ({
    week: point.week,
    operationalCapacity: point.healthScore,
    affectedDomains: result.domainImpacts.filter((impact) => impact.timeToExposure <= point.week).map((impact) => impact.domain),
    criticalFailures: point.criticalEvents,
  }));
  return {
    scenarioName: label,
    disruptionType: result.scenario.simulationType,
    totalWeeks: timeline.length,
    timeline,
    // The simulation models neither a mitigation nor a week of full recovery, so the playback has none to show.
    mitigationReplays: [],
    bottlenecksExposed: result.exacerbatedWeaknesses.map((weakness) => weakness.affectedArea),
    recoveryWeek: null,
    twelveWeekProjection: result.twelveWeekProjection,
    autonomousRecoveryProbability: result.autonomousRecoveryProbability,
    methodologyNote: result.methodologyNote,
    verifiedDependencyContext: result.verifiedDependencyContext,
  };
}

/** The governance tab: the cascade analysis, with what the dependency map says about each node it names. */
export function toGovernanceImpact(cascade: GovernanceCascadeAnalysis, map: PropagationMap): GovernanceImpactData {
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const labelOf = (id: string): string => nodeById.get(id)?.label ?? id;
  const nodes = cascade.governanceNodes.map((governance): GovernanceImpactData['nodes'][number] => {
    const node = nodeById.get(governance.id);
    return {
      id: governance.id,
      name: governance.label,
      type: node?.category === 'compliance' ? 'compliance' : 'governance',
      isSingleSource: node?.isSingleSource === true,
      dependsOn: map.edges.filter((edge) => edge.dependentId === governance.id).map((edge) => labelOf(edge.dependsOnId)),
      downstreamProcesses: (map.downstreamImpacts.find((impact) => impact.nodeId === governance.id)?.allAffectedNodes ?? []).map(labelOf),
      riskLevel: governance.criticality,
      evidenceBasis: governance.evidenceBasis,
    };
  });
  return {
    totalGovernanceProcesses: nodes.length,
    singleSourceProcesses: nodes.filter((node) => node.isSingleSource).length,
    criticalGovernanceGaps: cascade.cascadeRisks.filter((risk) => risk.severity === 'critical').map((risk) => risk.governanceGap),
    nodes,
    cascadeRisks: cascade.cascadeRisks.map((risk) => ({
      triggerNode: risk.governanceGap,
      cascadedProcesses: risk.impactedAreas.map(labelOf),
      severity: risk.severity,
      cascadeDepth: risk.cascadeDepth,
      evidenceBasis: risk.evidenceBasis,
    })),
    methodologyNote: cascade.methodologyNote,
    verifiedEvidenceCoverage: {
      nodesWithVerifiedEvidence: nodes.filter((node) => node.evidenceBasis === 'verified').length,
      totalNodes: nodes.length,
    },
  };
}

export interface MitigationOption {
  mitigationType: MitigationType;
  label: string;
  investmentLevel: MitigationScenario['investmentLevel'];
  durationWeeks: number;
  /** The nodes the intervention is aimed at. */
  targets: (graph: CognitionGraph) => string[];
}

const singleSource = (graph: CognitionGraph): string[] => idsOf(graph.nodes.filter((node) => node.isSingleSource));
const governance = (graph: CognitionGraph): string[] => idsOf(graph.nodes.filter(isGovernanceNode));

export const MITIGATION_OPTIONS: MitigationOption[] = [
  { mitigationType: 'documentation_campaign', label: 'Documentation Campaign', investmentLevel: 'medium', durationWeeks: 12, targets: singleSource },
  { mitigationType: 'cross_training', label: 'Cross-Training Program', investmentLevel: 'medium', durationWeeks: 16, targets: singleSource },
  { mitigationType: 'governance_decentralization', label: 'Governance Decentralization', investmentLevel: 'high', durationWeeks: 20, targets: governance },
];

/**
 * The scenarios to compare: each option aimed at the nodes of the graph it applies to. A scenario that reaches no node evaluates nothing, so an option with no node to
 * aim at is left out rather than sent.
 */
export function mitigationScenarios(graph: CognitionGraph): MitigationScenario[] {
  return MITIGATION_OPTIONS.flatMap((option) => {
    const targetNodeIds = option.targets(graph);
    return targetNodeIds.length === 0 ? [] : [{ mitigationType: option.mitigationType, targetNodeIds, investmentLevel: option.investmentLevel, durationWeeks: option.durationWeeks, label: option.label }];
  });
}

export interface MitigationView {
  scenarios: Array<{
    scenarioId: string;
    label: string;
    /** What was asked for, which the answer does not repeat. */
    investmentLevel: MitigationScenario['investmentLevel'] | null;
    durationWeeks: number | null;
    resilienceGain: number;
    exposureReductionPct: number;
    domainDeltas: Array<{ domain: string; baselineExposure: number; mitigatedExposure: number }>;
  }>;
  /** The label of the scenario with the highest projected gain; null when nothing was evaluated. */
  recommended: string | null;
  rationale: string;
  residualRisks: string[];
  /** The figures are the result of these assumptions, not of a calibrated model. */
  assumptions: string[];
  noNodesEvaluated: boolean;
  /** How many of the underlying dependency nodes have at least one currently-verified relationship on file. */
  verifiedEvidenceCoverage: { nodesWithVerifiedEvidence: number; totalNodes: number };
}

/** `requested` is what was sent: the answer lists its scenarios in the order they were asked for. */
export function toMitigationView(comparison: MitigationComparison, requested: MitigationScenario[]): MitigationView {
  return {
    scenarios: comparison.scenarios.map((result, index) => {
      const asked = requested[index]?.mitigationType === result.mitigationType ? requested[index] : undefined;
      return {
        scenarioId: result.scenarioId,
        label: result.label,
        investmentLevel: asked?.investmentLevel ?? null,
        durationWeeks: asked?.durationWeeks ?? null,
        resilienceGain: result.resilienceGain,
        exposureReductionPct: result.exposureReductionPct,
        domainDeltas: result.domainDeltas.map(({ domain, baselineExposure, mitigatedExposure }) => ({ domain, baselineExposure, mitigatedExposure })),
      };
    }),
    recommended: comparison.noNodesEvaluated ? null : (comparison.scenarios.find((result) => result.scenarioId === comparison.recommendedScenario)?.label ?? null),
    rationale: comparison.recommendationRationale,
    residualRisks: comparison.residualRisks,
    assumptions: comparison.assumptions,
    noNodesEvaluated: comparison.noNodesEvaluated,
    verifiedEvidenceCoverage: comparison.verifiedEvidenceCoverage,
  };
}
