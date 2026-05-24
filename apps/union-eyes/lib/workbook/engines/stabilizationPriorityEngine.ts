/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Transformation Roadmap
 * DOCTRINE_VERSION: 2.0.0
 *
 * Stabilization Priority Engine — sequences the 90-day stabilization
 * moves an institution should consider given the current continuity
 * landscape. Tone: institutionally responsible, NOT consulting
 * boilerplate.
 *
 * Pure, deterministic.
 */

export type StabilizationCategory =
  | 'successor_identification'
  | 'lineage_capture'
  | 'documentation'
  | 'governance_review'
  | 'onboarding_strengthening'
  | 'dependency_redistribution';

export interface StabilizationInput {
  /** Composite Stewardship Density Index (0–1). */
  readonly densityIndex: number;
  readonly unsuccessedInstitutionCriticalCount: number;
  readonly unsuccessedLoadBearingCount: number;
  readonly undocumentedProcessCount: number;
  readonly singleCarrierProcessCount: number;
  readonly governanceDriftAggregate: number;
  readonly onboardingCriticalCount: number;
  readonly breakpointCriticalCount: number;
}

export interface StabilizationMove {
  readonly id: string;
  readonly category: StabilizationCategory;
  readonly priority: 1 | 2 | 3;
  readonly summary: string;
  readonly weightOfEvidence: number;
}

const CATEGORY_SUMMARY: Record<StabilizationCategory, string> = {
  successor_identification:
    'Identify successors for institution-critical and load-bearing carriers without identified successors.',
  lineage_capture:
    'Capture lineage for the most exposed organizational decisions and operational practice.',
  documentation:
    'Document undocumented single-carrier processes, starting with the most institution-critical.',
  governance_review:
    'Surface and review the governance domains showing the most acute design-practice drift.',
  onboarding_strengthening:
    'Strengthen onboarding for the roles where onboarding is currently critically fragile.',
  dependency_redistribution:
    'Broaden carriers for the operational dependencies that concentrate on a single person.',
};

export function prioritizeStabilizationMoves(
  input: StabilizationInput,
): readonly StabilizationMove[] {
  const candidates: Array<{ category: StabilizationCategory; weight: number }> = [
    {
      category: 'successor_identification',
      weight: input.unsuccessedInstitutionCriticalCount * 1.0 + input.unsuccessedLoadBearingCount * 0.5,
    },
    {
      category: 'documentation',
      weight: input.undocumentedProcessCount * 0.6,
    },
    {
      category: 'dependency_redistribution',
      weight: input.singleCarrierProcessCount * 0.6,
    },
    {
      category: 'governance_review',
      weight: input.governanceDriftAggregate * 3.0,
    },
    {
      category: 'onboarding_strengthening',
      weight: input.onboardingCriticalCount * 1.0,
    },
    {
      category: 'lineage_capture',
      weight: input.breakpointCriticalCount * 0.75 + input.densityIndex * 1.5,
    },
  ];

  const sorted = [...candidates]
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  return sorted.map((c, idx) => ({
    id: `stabilization_${c.category}`,
    category: c.category,
    priority: (idx === 0 ? 1 : idx <= 2 ? 2 : 3) as 1 | 2 | 3,
    summary: CATEGORY_SUMMARY[c.category],
    weightOfEvidence: round2(c.weight),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
