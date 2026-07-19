import type {
  SituationAssessment,
  ProblemAnalysis,
  DecisionAnalysis,
  PPOAAnalysis,
} from '@nzila/decision-intelligence-engine'
import type { GovernanceRationale } from '@nzila/governance-rationale'
import type { DecisionEvidencePack } from '@nzila/decision-evidence'
import {
  computeOverallRiskScore,
  computeDriftDiagnostics,
  type ContinuityTrendPoint,
} from '@nzila/continuity-analysis'
import type {
  LineageNode,
  LineageEdge,
  DependencyRiskReport,
} from '@nzila/institutional-intelligence'

export type KTDecisionIntelligenceSnapshot = {
  generatedAt: string
  situationAssessments: SituationAssessment[]
  problemAnalyses: ProblemAnalysis[]
  decisionAnalyses: DecisionAnalysis[]
  ppoaAnalyses: PPOAAnalysis[]
  rationales: GovernanceRationale[]
  evidencePacks: DecisionEvidencePack[]
  continuitySignal: {
    governanceDriftScore: number
    operationalFragilityIndex: number
    institutionalMemoryScore: number
    escalationInstabilityScore: number
    overallRiskScore: number
  }
  continuityDiagnostics: {
    trajectory: 'improving' | 'stable' | 'degrading' | 'volatile' | 'insufficient-data'
    overallVelocityPct: number
    governanceDriftVelocityPct: number
    operationalConcentrationVelocityPct: number
    institutionalMemoryVelocityPct: number
    escalationInstabilityVelocityPct: number
    accelerationPct: number
  }
  lineage: {
    nodes: LineageNode[]
    edges: LineageEdge[]
  }
  dependencyRiskReport: DependencyRiskReport
  replayTimeline: {
    at: string
    rationaleId: string
    decisionTitle: string
    policyRef: string | null
    acceptedRiskCount: number
    rejectedAlternativeCount: number
    mitigationCommitmentCount: number
  }[]
}

export async function getKTDecisionIntelligenceSnapshot(): Promise<KTDecisionIntelligenceSnapshot> {
  const now = new Date().toISOString()

  const situationAssessments: SituationAssessment[] = [
    {
      id: '1e6f72a9-e6c6-4a8e-8752-67dd2f6d9ad1',
      orgId: 'nzila-control-plane',
      category: 'continuity',
      concern: 'Decision evidence sealing backlog exceeds governance SLA in production.',
      urgency: 4,
      impact: 5,
      priorityScore: 20,
      trend: 'worsening',
      evidenceRefs: ['ev-chain-lag-2026-05-26', 'ev-sla-breach-2026-05-27'],
      dependencies: ['evidence-worker', 'policy-replay-service', 'audit-snapshot-job'],
      unknowns: ['Exact dependency between replay queue saturation and hash-chain lag.'],
      recommendedActions: [
        'Scale evidence worker concurrency by policy tier.',
        'Enable replay queue pressure controls before next release gate.',
      ],
      escalationThreshold: 'urgency >= 4 AND impact >= 4',
      escalated: true,
      escalatedAt: now,
      ownerId: 'ops-governance-lead',
      continuityImplications: [
        'Delayed evidence availability weakens procurement-grade verification.',
        'Audit replay timeliness risk for regulated attestations.',
      ],
      status: 'escalated',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '5a8f03d9-4ad8-4f33-9b97-5a7a8d132ce0',
      orgId: 'nzila-control-plane',
      category: 'governance',
      concern: 'Policy exception approvals are concentrating in one approver lane.',
      urgency: 3,
      impact: 4,
      priorityScore: 12,
      trend: 'volatile',
      evidenceRefs: ['ev-approval-concentration-2026-05'],
      dependencies: ['governance-review', 'org-roles'],
      unknowns: ['Whether staffing gap or policy routing config is dominant cause.'],
      recommendedActions: ['Enforce dual-lane approver requirement for critical gates.'],
      escalationThreshold: 'priorityScore >= 16',
      escalated: false,
      escalatedAt: null,
      ownerId: 'governance-operations',
      continuityImplications: ['Approval concentration increases institutional fragility.'],
      status: 'monitoring',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const problemAnalyses: ProblemAnalysis[] = [
    {
      id: '0cb76a5a-dfd9-47f2-a1d7-8d628b25f80a',
      orgId: 'nzila-control-plane',
      title: 'Evidence chain degradation under governance replay load',
      description: 'Replay throughput dropped 41% following release cp-2026.05.24.',
      deviationType: 'evidence-chain-degradation',
      what: {
        is: 'Delayed evidence sealing and replay confirmation.',
        isNot: 'Policy rule evaluation correctness.',
        distinctives: ['Hash-chain delay appears only in high-volume replay windows.'],
      },
      where: {
        is: 'Production evidence pipeline and replay queue.',
        isNot: 'Staging replay pipeline.',
        locations: ['azure-ca-central', 'control-plane-governance-cluster'],
      },
      when: {
        is: 'After cp-2026.05.24 release deployment windows.',
        isNot: 'Before queue partitioning change.',
        firstOccurrence: now,
        lastOccurrence: null,
        pattern: 'escalating',
      },
      extent: {
        is: 'Critical governance events with high evidence fan-out.',
        isNot: 'Low-volume decision logs.',
        affectedCount: 84,
        severityLevel: 4,
      },
      hypotheses: [],
      confirmedCause: null,
      confirmedCauseHypothesisId: null,
      evidenceRefs: ['ev-replay-latency-dataset', 'ev-audit-queue-depth'],
      releaseCorrelations: [
        {
          releaseId: 'cp-2026.05.24',
          releasedAt: now,
          changeDescription: 'Replay partitioning optimization and governance export refactor.',
          correlationStrength: 'likely',
        },
      ],
      telemetryMarkers: [
        {
          metric: 'governance.replay.queue.depth',
          observedAt: now,
          value: 1472,
          baseline: 530,
          deviationPct: 177.7,
        },
      ],
      governanceReplayRef: 'replay-2026-05-27-01',
      continuityImplications: ['Procurement export timing reliability reduced for critical windows.'],
      situationAssessmentRef: situationAssessments[0].id,
      mitigations: [],
      analysisConfidence: 42,
      confidenceSemantics: 'low',
      evidenceCompleteness: 45,
      assumptionDensity: 1.5,
      unresolvedUnknowns: 3,
      dependencyVolatility: 'high',
      status: 'investigating',
      ownerId: 'reliability-lead',
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    },
  ]

  const decisionAnalyses: DecisionAnalysis[] = [
    {
      id: 'fa698693-9830-4f88-90e2-cb2f5f23aeb2',
      orgId: 'nzila-control-plane',
      title: 'Replay queue resilience strategy selection',
      objective: 'Select resilient governance replay architecture with audit-grade continuity.',
      decisionType: 'architecture',
      mustCriteria: [
        {
          id: '250f8f54-310f-4f70-8878-92d3f2667880',
          label: 'Replay determinism',
          description: 'Must preserve deterministic replay behavior.',
          isGo: true,
        },
      ],
      wantCriteria: [
        {
          id: '61eb5b67-f154-4ece-bcb9-d1e93d341499',
          label: 'Operational recovery speed',
          description: 'Faster mean time to continuity recovery.',
          weight: 9,
        },
      ],
      alternatives: [],
      rejectedAlternatives: [],
      selectedAlternativeId: null,
      rationale: '',
      rationaleEvidenceRefs: [],
      riskAcceptances: [],
      mitigationCommitments: [],
      approvers: [],
      allApproversSignedOff: false,
      evidenceRefs: ['ev-queue-architecture-eval'],
      continuityImplications: ['Architecture chosen here sets continuity baseline for all governance products.'],
      confidenceSemantics: 'moderate',
      evidenceCompleteness: 62,
      assumptionDensity: 2.2,
      unresolvedUnknowns: 2,
      dependencyVolatility: 'moderate',
      supersededBy: null,
      supersedes: null,
      status: 'under-review',
      ownerId: 'platform-architecture',
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
    },
  ]

  const ppoaAnalyses: PPOAAnalysis[] = [
    {
      id: 'e7ad8a77-34c2-4fdb-b531-802da13e0dba',
      orgId: 'nzila-control-plane',
      title: 'Governance replay migration PPOA',
      context: 'Pre-mortem and opportunity scan before replay migration wave 2.',
      contextType: 'migration',
      releaseRef: 'cp-2026.06.01',
      pilotRef: null,
      decisionAnalysisRef: decisionAnalyses[0].id,
      risks: [],
      opportunities: [],
      operationalReadinessScore: 67,
      rolloutConfidenceScore: 61,
      governanceMaturity: 'managed',
      criticalRiskCount: 1,
      criticalRiskThreshold: 15,
      evidenceRefs: ['ev-ppoa-migration-wave2'],
      ownerId: 'release-governance',
      targetDate: now,
      status: 'reviewed',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const rationales: GovernanceRationale[] = [
    {
      id: '614d58f2-528b-45de-aa69-b9bd759ec2ec',
      orgId: 'nzila-control-plane',
      decisionTitle: 'Dual-lane governance replay approval model',
      decisionType: 'policy-change',
      trigger: 'risk-escalation',
      context: 'Replay queue instability and approval concentration increased continuity risk.',
      deviation: 'Single-lane approval path violated institutional resilience objective.',
      outcome: 'Dual-lane approval with mandatory continuity checkpoint before release.',
      rationale: 'Distributing approval authority reduces concentration risk and improves replay defensibility.',
      supportingEvidenceRefs: ['ev-approval-concentration-2026-05', 'ev-replay-instability-2026-05'],
      assumptions: [],
      alternativesRejected: [],
      acceptedRisks: [],
      mitigationCommitments: ['Introduce deputy approver rotation monthly.'],
      policyRef: 'policy/governance/replay-lane-v2',
      decisionAnalysisRef: decisionAnalyses[0].id,
      releaseRef: 'cp-2026.06.01',
      continuityImplications: ['Reduced key-person dependency in release governance.'],
      approvedBy: [
        { actorId: 'cgo', role: 'Chief Governance Officer', approvedAt: now },
      ],
      isReplayable: true,
      replayHash: 'f8b8c1296b1f8e6c15be4cf9f7f9ee3d775fdac6ebdcbe5eef38f1d4bc383fb0',
      status: 'active',
      ownerId: 'governance-operations',
      createdAt: now,
      updatedAt: now,
      supersededBy: null,
      supersedes: null,
    },
  ]

  const evidencePacks: DecisionEvidencePack[] = [
    {
      id: '7369cb7d-554a-4f64-8af2-7d40d91b62d6',
      orgId: 'nzila-control-plane',
      packType: 'composite',
      executiveSummary: 'Replay resilience decision pack for procurement and audit review.',
      decisionTitle: 'Governance replay resilience baseline',
      decisionOutcome: 'Proceed with dual-lane approval and queue partition hardening.',
      timeline: [
        {
          at: now,
          actor: 'governance-operations',
          event: 'Decision finalized and approved.',
          evidenceRef: 'ev-rationale-finalized',
        },
      ],
      scoringMatrix: { weightedTotal: 82 },
      evidenceRefs: [
        {
          refId: 'ecf655e7-c177-4300-b833-11ef6d2b2916',
          refType: 'telemetry',
          description: 'Replay queue depth telemetry extract',
          capturedAt: now,
          classification: 'CONFIDENTIAL',
          hash: '2d3f7c86f623cb3f0c11b57506d39fb2f6f22dce3762f7d08e4d3f8ef9d5f9f4',
        },
      ],
      policyReplayOutputs: [
        {
          policyRef: 'policy/governance/replay-lane-v2',
          replayedAt: now,
          result: 'pass',
          notes: 'No policy regression detected for dual-lane gate.',
        },
      ],
      alternativesRejected: [
        {
          name: 'Centralized single approver gate',
          reason: 'Introduces concentration and continuity fragility.',
        },
      ],
      acceptedRisks: [
        {
          risk: 'Short-term overhead in release approvals during transition.',
          severity: 2,
          acceptedBy: 'cgo',
          mitigationPlan: 'Run 4-week transition cadence and monitor lead time.',
        },
      ],
      mitigationPlans: [
        {
          commitment: 'Automate deputy approver rotation audits.',
          owner: 'governance-operations',
          targetDate: now,
          status: 'committed',
        },
      ],
      approvers: [
        {
          actorId: 'cgo',
          role: 'Chief Governance Officer',
          approvedAt: now,
          notes: 'Approved for release governance baseline.',
        },
      ],
      continuityImplications: ['Institutional continuity strengthened via distributed approvals.'],
      classification: 'CONFIDENTIAL',
      packHash: '2f77f58b0aeb8e1f795c8c5058fe2f610d4f198f954936ca4a4d3e7648f058f4',
      prevPackHash: null,
      sealed: true,
      sealedAt: now,
      schemaVersion: '1.0.0',
      createdAt: now,
    },
  ]

  const continuitySignal = {
    governanceDriftScore: 64,
    operationalFragilityIndex: 58,
    institutionalMemoryScore: 76,
    escalationInstabilityScore: 49,
    overallRiskScore: computeOverallRiskScore({
      governanceDriftScore: 64,
      operationalFragilityIndex: 58,
      institutionalMemoryScore: 76,
      escalationInstabilityScore: 49,
    }),
  }

  const continuityTrend: ContinuityTrendPoint[] = [
    {
      at: '2026-04-30T00:00:00.000Z',
      overallRiskScore: 48,
      governanceDriftScore: 45,
      operationalFragilityIndex: 50,
      institutionalMemoryScore: 79,
      escalationInstabilityScore: 41,
    },
    {
      at: '2026-05-10T00:00:00.000Z',
      overallRiskScore: 53,
      governanceDriftScore: 52,
      operationalFragilityIndex: 54,
      institutionalMemoryScore: 77,
      escalationInstabilityScore: 44,
    },
    {
      at: '2026-05-20T00:00:00.000Z',
      overallRiskScore: 58,
      governanceDriftScore: 59,
      operationalFragilityIndex: 56,
      institutionalMemoryScore: 76,
      escalationInstabilityScore: 47,
    },
    {
      at: now,
      overallRiskScore: continuitySignal.overallRiskScore,
      governanceDriftScore: continuitySignal.governanceDriftScore,
      operationalFragilityIndex: continuitySignal.operationalFragilityIndex,
      institutionalMemoryScore: continuitySignal.institutionalMemoryScore,
      escalationInstabilityScore: continuitySignal.escalationInstabilityScore,
    },
  ]

  const continuityDiagnostics = computeDriftDiagnostics(continuityTrend)

  const lineageNodes: LineageNode[] = [
    {
      id: 'node-decision-1',
      orgId: 'nzila-control-plane',
      nodeType: 'decision',
      title: decisionAnalyses[0].title,
      refId: decisionAnalyses[0].id,
      metadata: { status: decisionAnalyses[0].status },
      createdAt: now,
    },
    {
      id: 'node-situation-1',
      orgId: 'nzila-control-plane',
      nodeType: 'situation-assessment',
      title: situationAssessments[0].concern,
      refId: situationAssessments[0].id,
      metadata: { priorityScore: situationAssessments[0].priorityScore },
      createdAt: now,
    },
    {
      id: 'node-risk-1',
      orgId: 'nzila-control-plane',
      nodeType: 'risk',
      title: 'Replay backlog continuity risk',
      refId: 'risk-replay-backlog',
      metadata: { severity: 4 },
      createdAt: now,
    },
    {
      id: 'node-pack-1',
      orgId: 'nzila-control-plane',
      nodeType: 'evidence-pack',
      title: evidencePacks[0].decisionTitle,
      refId: evidencePacks[0].id,
      metadata: { sealed: evidencePacks[0].sealed },
      createdAt: now,
    },
  ]

  const lineageEdges: LineageEdge[] = [
    {
      id: '722e9d4c-fc8c-407d-9c99-8c0f7593e19b',
      orgId: 'nzila-control-plane',
      fromNodeId: 'node-decision-1',
      toNodeId: 'node-situation-1',
      relation: 'createdFrom',
      rationale: 'Decision initiated from escalated continuity situation appraisal.',
      evidenceRefs: ['ev-chain-lag-2026-05-26'],
      createdAt: now,
    },
    {
      id: '7d95ec73-8050-4a0e-b8b8-8f94714a72c4',
      orgId: 'nzila-control-plane',
      fromNodeId: 'node-decision-1',
      toNodeId: 'node-risk-1',
      relation: 'mitigates',
      rationale: 'Selected architecture reduces replay queue concentration risk.',
      evidenceRefs: ['ev-queue-architecture-eval'],
      createdAt: now,
    },
    {
      id: '3f4f6f2a-32cb-48c0-a2fe-30d6ee09f2b7',
      orgId: 'nzila-control-plane',
      fromNodeId: 'node-decision-1',
      toNodeId: 'node-pack-1',
      relation: 'references',
      rationale: 'Decision is bound to sealed procurement-safe evidence pack.',
      evidenceRefs: ['ev-rationale-finalized'],
      createdAt: now,
    },
  ]

  const dependencyRiskReport: DependencyRiskReport = {
    orgId: 'nzila-control-plane',
    generatedAt: now,
    overallRiskScore: 71,
    riskLevel: 'high',
    concentrationHotspots: [
      {
        personId: 'p-aubert',
        personName: 'Aubert',
        dependencyCount: 4,
        highCriticalityDomains: ['release-governance', 'vendor-negotiations', 'azure-infra'],
      },
    ],
    nodes: [
      {
        domain: 'release-governance',
        riskScore: 78,
        riskLevel: 'high',
        keyPeople: ['Aubert'],
      },
      {
        domain: 'policy-replay-operations',
        riskScore: 64,
        riskLevel: 'moderate',
        keyPeople: ['Aubert', 'Governance Ops Lead'],
      },
    ],
    recommendations: [
      'Mandate deputy ownership for release governance and replay operations.',
      'Increase documentation coverage for high-risk continuity domains to at least 80%.',
    ],
  }

  const replayTimeline = rationales.map((r) => ({
    at: r.updatedAt,
    rationaleId: r.id,
    decisionTitle: r.decisionTitle,
    policyRef: r.policyRef,
    acceptedRiskCount: r.acceptedRisks.length,
    rejectedAlternativeCount: r.alternativesRejected.length,
    mitigationCommitmentCount: r.mitigationCommitments.length,
  }))

  return {
    generatedAt: now,
    situationAssessments,
    problemAnalyses,
    decisionAnalyses,
    ppoaAnalyses,
    rationales,
    evidencePacks,
    continuitySignal,
    continuityDiagnostics,
    lineage: {
      nodes: lineageNodes,
      edges: lineageEdges,
    },
    dependencyRiskReport,
    replayTimeline,
  }
}
