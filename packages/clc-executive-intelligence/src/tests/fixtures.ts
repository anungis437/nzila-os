/**
 * Shared test fixtures for CLC Executive Intelligence tests.
 */
import type {
  CorrelatedPattern,
  DecisionRecommendation,
  DecisionIntelligenceOutput,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
} from '../contracts/index';
import type { ExecutiveSnapshot, WatchLevel, ExecutivePriority } from '../contracts/index';

// ── Pattern Factory ─────────────────────────────────────────────────────────

export function makePattern(id: string, overrides: Partial<CorrelatedPattern> = {}): CorrelatedPattern {
  return {
    id,
    patternType: 'cross_affiliate_issue_cluster',
    title: `Pattern ${id}`,
    summary: `Summary for ${id}`,
    affectedSectors: ['Mining'],
    affectedAffiliateTypes: [],
    confidence: 0.7,
    watchLevel: 'elevated',
    evidenceRefs: [`ref:${id}`],
    ...overrides,
  };
}

// ── Recommendation Factory ──────────────────────────────────────────────────

export function makeRecommendation(
  id: string,
  overrides: Partial<DecisionRecommendation> = {},
): DecisionRecommendation {
  return {
    id,
    signalId: `P-${id}`,
    recommendedAction: 'monitor',
    timeframe: 'this_quarter',
    rationale: `Rationale for ${id}`,
    targetAudience: 'clc_executive',
    confidence: 0.7,
    ...overrides,
  };
}

// ── Decision Intelligence Output Factory ────────────────────────────────────

export function makeDecisionOutput(
  overrides: Partial<DecisionIntelligenceOutput> = {},
): DecisionIntelligenceOutput {
  const defaultRiskPosture: MovementRiskPosture = {
    posture: 'steady',
    watchAreas: [],
    risingSectors: [],
    issueClusters: [],
    summary: 'Movement activity is within normal ranges.',
    confidence: 0.75,
  };

  return {
    riskPosture: overrides.riskPosture ?? defaultRiskPosture,
    patterns: overrides.patterns ?? [],
    sectorDivergence: overrides.sectorDivergence ?? [],
    bargainingWatch: overrides.bargainingWatch ?? null,
    recommendations: overrides.recommendations ?? [],
    briefingCards: overrides.briefingCards ?? [],
  };
}

// ── Complex Decision Output (heightened posture) ────────────────────────────

export function makeHeightenedOutput(): DecisionIntelligenceOutput {
  const patterns: CorrelatedPattern[] = [
    makePattern('P1', {
      watchLevel: 'critical',
      confidence: 0.9,
      affectedSectors: ['Mining', 'Healthcare', 'Education'],
      patternType: 'cross_affiliate_issue_cluster',
      title: 'Cross-sector wage pressure cluster',
    }),
    makePattern('P2', {
      watchLevel: 'high',
      confidence: 0.8,
      affectedSectors: ['Mining', 'Construction'],
      patternType: 'bargaining_pressure_signal',
      title: 'Mining bargaining pressure signal',
    }),
    makePattern('P3', {
      watchLevel: 'elevated',
      confidence: 0.6,
      affectedSectors: ['Healthcare'],
      patternType: 'cross_sector_shift',
      title: 'Healthcare staffing concerns',
    }),
    makePattern('P4', {
      watchLevel: 'monitor',
      confidence: 0.5,
      affectedSectors: ['Education'],
      patternType: 'precedent_concentration',
      title: 'Education precedent cascade',
    }),
  ];

  const recommendations: DecisionRecommendation[] = [
    makeRecommendation('R1', {
      signalId: 'P1',
      recommendedAction: 'intervene',
      timeframe: 'now',
      confidence: 0.85,
    }),
    makeRecommendation('R2', {
      signalId: 'P2',
      recommendedAction: 'escalate',
      timeframe: '7_days',
      confidence: 0.8,
    }),
    makeRecommendation('R3', {
      signalId: 'P3',
      recommendedAction: 'prepare',
      timeframe: '30_days',
      confidence: 0.65,
    }),
    makeRecommendation('R4', {
      signalId: 'P4',
      recommendedAction: 'monitor',
      timeframe: 'this_quarter',
      confidence: 0.5,
    }),
  ];

  const divergence: SectorDivergence[] = [
    {
      sector: 'Mining',
      divergenceScore: 0.8,
      uniqueFactors: ['Safety', 'Overtime'],
      commonFactors: ['Wages'],
      velocity: 0.6,
      classification: 'pre_bargaining_acceleration',
    },
    {
      sector: 'Healthcare',
      divergenceScore: 0.4,
      uniqueFactors: ['Staffing'],
      commonFactors: ['Wages', 'Benefits'],
      velocity: 0.3,
      classification: 'stable',
    },
  ];

  const bargainingWatch: BargainingWatch = {
    sectors: ['Mining', 'Construction'],
    headline: 'Bargaining pressure rising in Mining and Construction sectors',
    signalStrength: 'strong',
    preparationIndicators: ['Mining CBA expires Q3 2026'],
    recommendedAction: 'escalate',
    confidence: 0.82,
    evidenceRefs: ['ref:bargaining-mining', 'ref:bargaining-construction'],
  };

  const briefingCards: ExecutiveBriefingCard[] = [
    {
      id: 'BC1',
      category: 'risk',
      headline: 'Wage pressure across three sectors',
      significance: 'Cross-sector wage pressure detected in Mining, Healthcare, and Education.',
      confidence: 0.85,
      confidenceBand: 'high',
      recommendedAction: 'intervene',
      timeframe: 'now',
      watchLevel: 'critical',
      evidenceRefs: ['ref:P1'],
    },
  ];

  return makeDecisionOutput({
    riskPosture: {
      posture: 'heightened',
      watchAreas: ['Mining sector wage pressure', 'Bargaining timelines'],
      risingSectors: ['Mining', 'Healthcare'],
      issueClusters: ['Wages', 'Safety'],
      summary: 'Multiple high-severity signals detected across sectors.',
      confidence: 0.85,
    },
    patterns,
    sectorDivergence: divergence,
    bargainingWatch,
    recommendations,
    briefingCards,
  });
}

// ── Snapshot Factory ────────────────────────────────────────────────────────

export function makeSnapshot(overrides: Partial<ExecutiveSnapshot> = {}): ExecutiveSnapshot {
  return {
    id: 'SNAP-TEST-001',
    generatedAt: '2026-04-01T00:00:00.000Z',
    posture: 'steady',
    confidence: 0.75,
    activePatternIds: [],
    patternWatchLevels: {},
    actionCounts: { monitor: 0, prepare: 0, escalate: 0, intervene: 0 },
    topPriorityIds: [],
    divergentSectors: [],
    bargainingWatchActive: false,
    briefingCardCount: 0,
    ...overrides,
  };
}

// ── Priority Factory ────────────────────────────────────────────────────────

export function makePriority(
  id: string,
  overrides: Partial<ExecutivePriority> = {},
): ExecutivePriority {
  return {
    id,
    title: `Priority ${id}`,
    watchLevel: 'elevated',
    recommendedAction: 'monitor',
    timeframe: 'this_quarter',
    confidence: 0.7,
    whyItMatters: `Why ${id} matters`,
    evidenceRefs: [`ref:${id}`],
    sourceTypes: ['pattern'],
    priorityScore: 0.5,
    ...overrides,
  };
}
