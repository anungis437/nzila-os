/**
 * What the continuity simulation workspace shows is mapped from what the services return (UE-CONV-H-027): the dependency map drawn as a graph, a simulation result played
 * back week by week, the cascade analysis read as governance impact, and the mitigation comparison laid out beside what was asked for. A value the service does not
 * give is left out, never filled in with a default, and a simulation or comparison is aimed only at nodes the organization's own graph has.
 */
import { describe, expect, it } from 'vitest'
import type { GovernanceCascadeAnalysis } from '@/lib/knowledge-transfer/cascade-analysis/cascade-analyzer'
import type { MitigationComparison, MitigationScenario } from '@/lib/knowledge-transfer/mitigation-comparison/mitigation-models'
import type { DependencyNode, PropagationMap } from '@/lib/knowledge-transfer/propagation/propagation-models'
import type { ContinuitySimulationResult } from '@/lib/knowledge-transfer/simulation/simulation-models'
import { MITIGATION_OPTIONS, SIMULATION_PRESETS, mitigationScenarios, toCognitionGraph, toGovernanceImpact, toMitigationView, toPlayback } from './workspace-data'

const node = (id: string, over: Partial<DependencyNode> = {}): DependencyNode => ({
  id,
  label: `${id} label`,
  nodeType: 'expertise',
  category: 'operational',
  frequency: 2,
  associatedRoles: ['steward'],
  isSingleSource: false,
  continuitySensitivity: 'medium',
  sensitivityReason: 'why',
  ...over,
})

const MAP: PropagationMap = {
  organizationId: 'org',
  generatedAt: 'now',
  nodes: [
    node('gov', { category: 'governance', nodeType: 'governance', isSingleSource: true, continuitySensitivity: 'critical' }),
    node('payroll', { nodeType: 'system', isSingleSource: true }),
    node('vendorX', { nodeType: 'vendor', category: 'vendor' }),
    node('grievances'),
  ],
  edges: [
    { dependentId: 'payroll', dependsOnId: 'gov', strength: 'strong', evidenceCount: 2, rationale: '' },
    { dependentId: 'grievances', dependsOnId: 'vendorX', strength: 'weak', evidenceCount: 1, rationale: '' },
  ],
  downstreamImpacts: [
    {
      nodeId: 'gov',
      directDependents: ['payroll'],
      allAffectedNodes: ['payroll'],
      propagationPaths: [{ originId: 'gov', chainPath: ['gov', 'payroll'], impactScore: 70, disruptionScope: 'organizational', recoveryTimeWeeks: 6, affectedRoles: [], chainDepth: 1 }],
      totalExposureScore: 70,
      governanceExposure: [],
      vendorDependencyExposure: [],
      mitigation: { priority: 'high', actions: [] },
    },
  ],
  upstreamDependencies: [],
  couplingAnalysis: [],
  bottlenecks: [{ nodeId: 'gov', reason: 'single_source', riskLevel: 'critical', affectedRoles: [] }],
  resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
}

const EMPTY: PropagationMap = { ...MAP, nodes: [], edges: [], downstreamImpacts: [], bottlenecks: [] }

describe('toCognitionGraph', () => {
  it('draws the dependency map: only what the graph shows of each node, an edge from the dependent to what it depends on, and the paths the impact analysis found', () => {
    const graph = toCognitionGraph(MAP)

    expect(Object.keys(graph.nodes[0]).sort()).toEqual(['category', 'continuitySensitivity', 'frequency', 'id', 'isSingleSource', 'label', 'nodeType'])
    expect(graph.edges).toEqual([
      { sourceId: 'payroll', targetId: 'gov', strength: 3, edgeType: 'governance' },
      { sourceId: 'grievances', targetId: 'vendorX', strength: 1, edgeType: 'dependency' },
    ])
    expect(graph.propagationPaths).toEqual([{ path: ['gov', 'payroll'], impactScore: 70, disruptionScope: 'organizational' }])
    expect(graph.bottlenecks).toEqual(['gov'])
  })
})

describe('what a simulation is aimed at', () => {
  const graph = toCognitionGraph(MAP)
  const aimed = (id: string, g = graph) => SIMULATION_PRESETS.find((preset) => preset.id === id)!.affected(g)

  it('is the nodes of the organization that the disruption would reach', () => {
    expect(aimed('retirement_wave')).toEqual(['gov', 'payroll'])
    expect(aimed('rapid_turnover')).toEqual(['gov'])
    expect(aimed('governance_transition')).toEqual(['gov'])
    expect(aimed('vendor_disruption')).toEqual(['vendorX'])
  })

  it('is nothing when the graph has no such node, so the scenario can be refused up front instead of answered with a reassuring result', () => {
    const empty = toCognitionGraph(EMPTY)
    for (const preset of SIMULATION_PRESETS) expect(preset.affected(empty), preset.id).toEqual([])
    expect(SIMULATION_PRESETS.every((preset) => preset.noneReason.length > 0)).toBe(true)
  })
})

describe('toPlayback', () => {
  const result = {
    scenario: { simulationType: 'retirement', affectedNodeIds: ['gov'] },
    degradationTimeline: [
      { week: 0, healthScore: 80, domainsAtRisk: 0, accelerationFactor: 1, criticalEvents: [] },
      { week: 2, healthScore: 60, domainsAtRisk: 1, accelerationFactor: 1.2, criticalEvents: ['payroll stalls'] },
    ],
    domainImpacts: [{ domain: 'payroll', impactSeverity: 'high', degradationPercentage: 40, timeToExposure: 2, hasWorkarounds: false, workaroundComplexity: 'complex' }],
    exacerbatedWeaknesses: [{ weaknessType: 'single_source', affectedArea: 'payroll', severity: 'high', isExacerbated: true, mitigation: 'document it' }],
    twelveWeekProjection: 55,
    autonomousRecoveryProbability: 30,
    methodologyNote: 'scenario model, not a confirmed measurement',
    verifiedDependencyContext: { affectedNodesWithVerifiedEvidence: 0, totalAffectedNodes: 1 },
  } as unknown as ContinuitySimulationResult

  it("plays back the simulation's own timeline, with a domain affected from the week it is exposed", () => {
    const playback = toPlayback(result, 'Retirement Wave')

    expect(playback.scenarioName).toBe('Retirement Wave')
    expect(playback.disruptionType).toBe('retirement')
    expect(playback.totalWeeks).toBe(2)
    expect(playback.timeline).toEqual([
      { week: 0, operationalCapacity: 80, affectedDomains: [], criticalFailures: [] },
      { week: 2, operationalCapacity: 60, affectedDomains: ['payroll'], criticalFailures: ['payroll stalls'] },
    ])
    expect(playback.bottlenecksExposed).toEqual(['payroll'])
    expect(playback.twelveWeekProjection).toBe(55)
    expect(playback.autonomousRecoveryProbability).toBe(30)
    expect(playback.methodologyNote).toBe('scenario model, not a confirmed measurement')
    expect(playback.verifiedDependencyContext).toEqual({ affectedNodesWithVerifiedEvidence: 0, totalAffectedNodes: 1 })
  })

  it('shows no mitigation and no recovery week, because the simulation models neither', () => {
    const playback = toPlayback(result, 'x')
    expect(playback.mitigationReplays).toEqual([])
    expect(playback.recoveryWeek).toBeNull()
  })
})

describe('toGovernanceImpact', () => {
  const cascade: GovernanceCascadeAnalysis = {
    organizationId: 'org',
    generatedAt: 'now',
    methodologyNote: 'Exploratory unless a currently-verified dependency record is on file.',
    governanceNodes: [{ id: 'gov', label: 'Bylaw amendment procedure', criticality: 'critical', evidenceBasis: 'exploratory' }],
    cascadeRisks: [{ governanceGap: 'Bylaw amendment procedure', impactedAreas: ['payroll'], severity: 'critical', cascadeDepth: 2, evidenceBasis: 'exploratory' }],
    regulatoryRisks: [],
    regulatoryAssessment: 'dependency_only_no_regulation_assessed',
    recommendations: [],
  }

  it('reads the cascade analysis, with what the dependency map says about each node it names', () => {
    const impact = toGovernanceImpact(cascade, MAP)

    expect(impact.totalGovernanceProcesses).toBe(1)
    expect(impact.singleSourceProcesses).toBe(1)
    expect(impact.criticalGovernanceGaps).toEqual(['Bylaw amendment procedure'])
    expect(impact.nodes).toEqual([{ id: 'gov', name: 'Bylaw amendment procedure', type: 'governance', isSingleSource: true, dependsOn: [], downstreamProcesses: ['payroll label'], riskLevel: 'critical', evidenceBasis: 'exploratory' }])
    expect(impact.cascadeRisks).toEqual([{ triggerNode: 'Bylaw amendment procedure', cascadedProcesses: ['payroll label'], severity: 'critical', cascadeDepth: 2, evidenceBasis: 'exploratory' }])
    expect(impact.methodologyNote).toBe('Exploratory unless a currently-verified dependency record is on file.')
    expect(impact.verifiedEvidenceCoverage).toEqual({ nodesWithVerifiedEvidence: 0, totalNodes: 1 })
  })

  it('counts a governance node as verified evidence coverage only when its evidenceBasis says verified', () => {
    const impact = toGovernanceImpact({ ...cascade, governanceNodes: [{ ...cascade.governanceNodes[0], evidenceBasis: 'verified' }] }, MAP)
    expect(impact.nodes[0].evidenceBasis).toBe('verified')
    expect(impact.verifiedEvidenceCoverage).toEqual({ nodesWithVerifiedEvidence: 1, totalNodes: 1 })
  })

  it('has no gap to report when nothing is critical, and names an area the map does not have by its id rather than inventing a label', () => {
    const impact = toGovernanceImpact({ ...cascade, cascadeRisks: [{ governanceGap: 'x', impactedAreas: ['unknown-node'], severity: 'high', cascadeDepth: 1, evidenceBasis: 'exploratory' }] }, MAP)
    expect(impact.criticalGovernanceGaps).toEqual([])
    expect(impact.cascadeRisks[0].cascadedProcesses).toEqual(['unknown-node'])
  })
})

describe('mitigationScenarios', () => {
  it('aims each option at the nodes of the graph it applies to', () => {
    const scenarios = mitigationScenarios(toCognitionGraph(MAP))

    expect(scenarios.map((scenario) => [scenario.mitigationType, scenario.targetNodeIds])).toEqual([
      ['documentation_campaign', ['gov', 'payroll']],
      ['cross_training', ['gov', 'payroll']],
      ['governance_decentralization', ['gov']],
    ])
    expect(scenarios.map((scenario) => scenario.label)).toEqual(MITIGATION_OPTIONS.map((option) => option.label))
  })

  it('leaves out an option that has no node to aim at, because a comparison that reaches nothing evaluates nothing', () => {
    expect(mitigationScenarios(toCognitionGraph(EMPTY))).toEqual([])
    const onlyVendors = toCognitionGraph({ ...EMPTY, nodes: [node('v', { nodeType: 'vendor' })] })
    expect(mitigationScenarios(onlyVendors)).toEqual([])
  })
})

describe('toMitigationView', () => {
  const requested = mitigationScenarios(toCognitionGraph(MAP)) as MitigationScenario[]
  const result = (id: string, type: string, gain: number) => ({
    scenarioId: id,
    label: `${type} label`,
    mitigationType: type,
    resilienceGain: gain,
    exposureReductionPct: 30.4,
    domainDeltas: [{ domain: 'payroll', baselineExposure: 70, mitigatedExposure: 40, exposureReduction: 30, confidence: 'unvalidated' }],
  })
  const comparison = {
    organizationId: 'org',
    generatedAt: 'now',
    baselineScore: 60,
    scenarios: [result('s1', 'documentation_campaign', 12), result('s2', 'cross_training', 15), result('s3', 'governance_decentralization', 9)],
    recommendedScenario: 's2',
    recommendationRationale: 'Under the assumptions listed, cross training has the highest projected gain.',
    residualRisks: ['payroll remains single-source'],
    basis: 'ASSUMED_EFFECTIVENESS_NOT_CALIBRATED',
    assumptions: ['Effectiveness is a fixed table of assumed multipliers.'],
    noNodesEvaluated: false,
    verifiedEvidenceCoverage: { nodesWithVerifiedEvidence: 1, totalNodes: 4 },
  } as unknown as MitigationComparison

  it('lays the answer out beside what was asked for, names the recommended scenario by its label, and carries the assumptions', () => {
    const view = toMitigationView(comparison, requested)

    expect(view.scenarios.map((scenario) => [scenario.scenarioId, scenario.investmentLevel, scenario.durationWeeks])).toEqual([
      ['s1', 'medium', 12],
      ['s2', 'medium', 16],
      ['s3', 'high', 20],
    ])
    expect(view.recommended).toBe('cross_training label')
    expect(view.assumptions).toEqual(['Effectiveness is a fixed table of assumed multipliers.'])
    expect(view.residualRisks).toEqual(['payroll remains single-source'])
    expect(view.verifiedEvidenceCoverage).toEqual({ nodesWithVerifiedEvidence: 1, totalNodes: 4 })
  })

  it('recommends nothing when nothing was evaluated, and does not guess what was asked for a scenario it cannot match to a request', () => {
    expect(toMitigationView({ ...comparison, noNodesEvaluated: true }, requested).recommended).toBeNull()
    const reordered = toMitigationView({ ...comparison, scenarios: [...comparison.scenarios].reverse() }, requested)
    expect(reordered.scenarios.map((scenario) => [scenario.investmentLevel, scenario.durationWeeks])).toEqual([
      [null, null],
      ['medium', 16],
      [null, null],
    ])
  })
})
