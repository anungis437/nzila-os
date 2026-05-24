/**
 * ARTIFACT TYPE: Cross-Module Synthesis Helper
 * DOCTRINE_VERSION: 2.0.0
 *
 * Reads across the six module engine results and surfaces composite
 * continuity signals that no single module would produce. Pure,
 * deterministic, anti-surveillance: aggregates only.
 */

export type CrossSignalCategory =
  | 'density_onboarding_survivability_gap'
  | 'modernization_lineage_erosion_compound'
  | 'governance_continuity_reconstruction_compound'
  | 'mapping_underway_with_acute_breakpoints'
  | 'landscape_healthy_lineage_fading'
  | 'stabilization_underway_without_governance_review';

export interface CrossModuleAggregates {
  readonly densityIndex: number;
  readonly onboardingCriticalCount: number;
  readonly breakpointCriticalCount: number;
  readonly modernizationErodingCount: number;
  readonly lineageLapsedOrFadingCount: number;
  readonly governanceDriftAggregate: number;
  readonly reconstructionBurdenMean: number;
  readonly mappingComplete: boolean;
  readonly stabilizationRatified: boolean;
  readonly governanceReviewPresent: boolean;
  readonly landscapePosture: 'distributed' | 'observed' | 'concentrated' | 'fragile' | 'critical';
}

export interface CrossModuleSignal {
  readonly signalId: string;
  readonly severity: 'note' | 'observation' | 'warning' | 'critical';
  readonly category: CrossSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export function deriveCrossModuleSignals(
  agg: CrossModuleAggregates,
): readonly CrossModuleSignal[] {
  const out: CrossModuleSignal[] = [];

  if (agg.densityIndex >= 0.6 && agg.onboardingCriticalCount >= 1) {
    out.push({
      signalId: 'cross_density_onboarding_survivability_gap',
      severity: agg.onboardingCriticalCount >= 3 ? 'critical' : 'warning',
      category: 'density_onboarding_survivability_gap',
      statement:
        'Stewardship density is concentrated and onboarding is critically fragile in one or more roles; institutional survivability depends on a small number of carriers with no resilient route in.',
      evidence: {
        densityIndex: agg.densityIndex,
        onboardingCriticalCount: agg.onboardingCriticalCount,
      },
    });
  }

  if (agg.modernizationErodingCount >= 1 && agg.lineageLapsedOrFadingCount >= 1) {
    out.push({
      signalId: 'cross_modernization_lineage_erosion_compound',
      severity: agg.modernizationErodingCount >= 2 ? 'critical' : 'warning',
      category: 'modernization_lineage_erosion_compound',
      statement:
        'Modernization initiatives are displacing carriers while lineage is lapsing; continuity erosion compounds across the two surfaces.',
      evidence: {
        modernizationErodingCount: agg.modernizationErodingCount,
        lineageLapsedOrFadingCount: agg.lineageLapsedOrFadingCount,
      },
    });
  }

  if (
    agg.governanceDriftAggregate >= 0.5 &&
    agg.reconstructionBurdenMean >= 0.5
  ) {
    out.push({
      signalId: 'cross_governance_continuity_reconstruction_compound',
      severity: 'warning',
      category: 'governance_continuity_reconstruction_compound',
      statement:
        'Governance design-practice drift is acute and reconstruction burden is high; the institution would carry a substantial cost to restore practice if current carriers became unavailable.',
      evidence: {
        governanceDriftAggregate: agg.governanceDriftAggregate,
        reconstructionBurdenMean: agg.reconstructionBurdenMean,
      },
    });
  }

  if (agg.mappingComplete && agg.breakpointCriticalCount >= 1) {
    out.push({
      signalId: 'cross_mapping_underway_with_acute_breakpoints',
      severity: agg.breakpointCriticalCount >= 3 ? 'critical' : 'warning',
      category: 'mapping_underway_with_acute_breakpoints',
      statement:
        'Mapping is complete and acute continuity breakpoints are present; stabilization is the next required phase.',
      evidence: {
        breakpointCriticalCount: agg.breakpointCriticalCount,
      },
    });
  }

  if (
    (agg.landscapePosture === 'distributed' || agg.landscapePosture === 'observed') &&
    agg.lineageLapsedOrFadingCount >= 1
  ) {
    out.push({
      signalId: 'cross_landscape_healthy_lineage_fading',
      severity: 'observation',
      category: 'landscape_healthy_lineage_fading',
      statement:
        'Continuity landscape is healthy at the carrier level, but lineage is fading; capture lineage now while the institution is well-stewarded.',
      evidence: {
        landscapePosture: agg.landscapePosture,
        lineageLapsedOrFadingCount: agg.lineageLapsedOrFadingCount,
      },
    });
  }

  if (agg.stabilizationRatified && !agg.governanceReviewPresent) {
    out.push({
      signalId: 'cross_stabilization_underway_without_governance_review',
      severity: 'warning',
      category: 'stabilization_underway_without_governance_review',
      statement:
        'Stabilization is underway without a documented governance review; ratification should accompany the stabilization moves.',
      evidence: {},
    });
  }

  return out;
}
