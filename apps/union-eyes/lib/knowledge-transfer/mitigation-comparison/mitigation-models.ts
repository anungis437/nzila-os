/**
 * Mitigation Comparison Models
 *
 * Data structures for comparing continuity intervention effectiveness.
 * Enables organizational continuity planning — not workforce optimization.
 *
 * All interventions are organizationally scoped: improving institutional
 * resilience, not evaluating or managing individuals.
 */

export type MitigationType =
  | 'documentation_campaign'
  | 'cross_training'
  | 'redundancy_improvement'
  | 'governance_decentralization'
  | 'vendor_diversification'
  | 'operational_restructuring'
  | 'continuity_mentorship'
  | 'institutional_transfer_program';

export interface MitigationScenario {
  /** Type of mitigation intervention */
  mitigationType: MitigationType;
  /** Affected node IDs (which operational domains this intervention targets) */
  targetNodeIds: string[];
  /** Estimated investment intensity: low | medium | high */
  investmentLevel: 'low' | 'medium' | 'high';
  /** Estimated duration of the intervention (weeks) */
  durationWeeks: number;
  /** Optional label for this scenario (e.g. "Option A — Documentation Sprint") */
  label?: string;
}

export interface MitigationImpactDelta {
  /** Operational domain improved */
  domain: string;
  /** Baseline continuity exposure (pre-mitigation, 0-100 higher = worse) */
  baselineExposure: number;
  /** Post-mitigation continuity exposure */
  mitigatedExposure: number;
  /** Net exposure reduction (positive = improvement) */
  exposureReduction: number;
  /** Confidence in this estimate */
  confidence: 'low' | 'medium' | 'high';
}

export interface ResilienceImprovementProjection {
  /** Week into the future */
  week: number;
  /** Continuity health score with this mitigation (0-100) */
  mitigatedHealthScore: number;
  /** What health score would be WITHOUT mitigation */
  baselineHealthScore: number;
  /** Net improvement delta */
  delta: number;
}

export interface MitigationResult {
  /** Unique ID for this comparison scenario */
  scenarioId: string;
  /** Human label */
  label: string;
  mitigationType: MitigationType;
  /** Baseline continuity score before mitigation */
  baselineScore: number;
  /** Projected continuity score 12 weeks after mitigation */
  projectedScore: number;
  /** Net resilience improvement (0-100 points) */
  resilienceGain: number;
  /** How much continuity exposure is reduced */
  exposureReductionPct: number;
  /** Governance stabilization improvement (0-100) */
  governanceStabilizationGain: number;
  /** Operational dependency concentration reduction (0-100) */
  dependencyConcentrationReduction: number;
  /** Domain-level impact breakdown */
  domainDeltas: MitigationImpactDelta[];
  /** 12-week projection curve */
  projectionCurve: ResilienceImprovementProjection[];
  /** Actionable steps for this mitigation */
  actionPlan: string[];
  /** Estimated effort to implement */
  implementationEffort: 'weeks' | 'months' | 'quarters';
  /** Expected return on continuity investment */
  continuityROI: 'low' | 'medium' | 'high' | 'transformative';
}

export interface MitigationComparison {
  organizationId: string;
  generatedAt: string;
  /** Baseline continuity score (no interventions) */
  baselineScore: number;
  /** Results for each compared mitigation scenario */
  scenarios: MitigationResult[];
  /** Which scenario produces the best overall continuity outcome */
  recommendedScenario: string;
  /** Strategic rationale for the recommendation */
  recommendationRationale: string;
  /** Areas that no mitigation scenario fully addresses */
  residualRisks: string[];
}

/**
 * Estimate resilience improvement multiplier by mitigation type.
 * Returns a 0–1 multiplier applied to the exposure reduction.
 */
export function getMitigationEffectivenessMultiplier(
  mitigationType: MitigationType,
  nodeType: string,
): number {
  const typeMap: Record<MitigationType, Partial<Record<string, number>>> = {
    documentation_campaign: {
      expertise: 0.7,
      procedure: 0.75,
      governance: 0.5,
      system: 0.3,
      vendor: 0.2,
    },
    cross_training: {
      expertise: 0.8,
      procedure: 0.6,
      governance: 0.7,
      system: 0.4,
      vendor: 0.2,
    },
    redundancy_improvement: {
      expertise: 0.6,
      system: 0.8,
      vendor: 0.5,
      procedure: 0.5,
      governance: 0.4,
    },
    governance_decentralization: {
      governance: 0.85,
      expertise: 0.4,
      procedure: 0.5,
      system: 0.2,
      vendor: 0.1,
    },
    vendor_diversification: {
      vendor: 0.9,
      system: 0.5,
      expertise: 0.1,
      governance: 0.1,
      procedure: 0.2,
    },
    operational_restructuring: {
      expertise: 0.5,
      procedure: 0.7,
      governance: 0.6,
      system: 0.5,
      vendor: 0.4,
    },
    continuity_mentorship: {
      expertise: 0.75,
      governance: 0.6,
      procedure: 0.5,
      system: 0.2,
      vendor: 0.1,
    },
    institutional_transfer_program: {
      expertise: 0.85,
      governance: 0.7,
      procedure: 0.65,
      system: 0.3,
      vendor: 0.2,
    },
  };
  return typeMap[mitigationType]?.[nodeType] ?? 0.4;
}

/**
 * Estimate implementation duration for a mitigation type.
 */
export function getMitigationDurationWeeks(
  mitigationType: MitigationType,
  investmentLevel: 'low' | 'medium' | 'high',
): number {
  const baseDuration: Record<MitigationType, number> = {
    documentation_campaign: 6,
    cross_training: 12,
    redundancy_improvement: 8,
    governance_decentralization: 16,
    vendor_diversification: 20,
    operational_restructuring: 24,
    continuity_mentorship: 12,
    institutional_transfer_program: 16,
  };
  const levelMultiplier = { low: 1.5, medium: 1.0, high: 0.7 };
  return Math.round(baseDuration[mitigationType] * levelMultiplier[investmentLevel]);
}
