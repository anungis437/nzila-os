/**
 * Resilience Strategy Models
 *
 * Data structures for modeling organizational continuity strengthening strategies.
 * Strategies are organizational investment pathways — not workforce plans.
 *
 * All models describe organizational capability improvements:
 * documentation, governance distribution, operational redundancy.
 */

export type StrategyType =
  | 'documentation_foundation'
  | 'knowledge_decentralization'
  | 'governance_distribution'
  | 'operational_redundancy'
  | 'vendor_diversification'
  | 'continuity_mentorship_program'
  | 'institutional_transfer_initiative';

export type MaturityStage = 'initial' | 'developing' | 'managed' | 'optimized';

export interface StrategyMilestone {
  /** Week at which this milestone is expected */
  week: number;
  /** What should be achieved */
  description: string;
  /** How to verify completion */
  successCriteria: string;
  /** Which resilience dimension this advances */
  dimensionImpacted: string;
}

export interface ResilienceStrategyModel {
  strategyType: StrategyType;
  /** Short human name */
  name: string;
  /** Purpose and approach */
  description: string;
  /** Current maturity stage the organization is at for this strategy */
  currentMaturity: MaturityStage;
  /** Target maturity stage if this strategy is fully executed */
  targetMaturity: MaturityStage;
  /** Total estimated duration to achieve target maturity */
  estimatedDurationWeeks: number;
  /** Projected resilience score improvement (0-40 points) */
  projectedResilienceGain: number;
  /** Continuity maturity progression description */
  maturityProgression: string;
  /** Governance stability improvement (0-100) */
  governanceStabilityGain: number;
  /** Dependency reduction impact (0-100) */
  dependencyReductionImpact: number;
  /** Key milestones */
  milestones: StrategyMilestone[];
  /** Enablers: what makes this strategy more effective */
  enablers: string[];
  /** Blockers: what could prevent success */
  potentialBlockers: string[];
  /** Key Performance Indicators for this strategy */
  kpis: string[];
}

export interface ResilienceRoadmap {
  organizationId: string;
  generatedAt: string;
  /** Current overall resilience score */
  currentScore: number;
  /** Projected score if all strategies are executed */
  projectedScore: number;
  /** Recommended strategies in priority order */
  strategies: ResilienceStrategyModel[];
  /** Phase 1: quick wins (0-8 weeks) */
  phase1QuickWins: string[];
  /** Phase 2: foundation building (8-24 weeks) */
  phase2Foundation: string[];
  /** Phase 3: sustained resilience (24+ weeks) */
  phase3Sustained: string[];
  /** Overall maturity progression narrative */
  maturityNarrative: string;
}
