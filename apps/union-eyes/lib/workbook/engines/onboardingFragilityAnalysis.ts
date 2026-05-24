/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Breakpoints
 * DOCTRINE_VERSION: 2.0.0
 *
 * Onboarding Fragility Analysis — surfaces how fragile institutional
 * onboarding is across the workbook's named roles. Onboarding fragility
 * compounds breakpoint risk because new carriers cannot absorb practice
 * fast enough to prevent quiet continuity failure.
 *
 * Pure, deterministic.
 */

export interface OnboardingRoleInput {
  /** Stable abstract id, e.g. "role_A". */
  readonly id: string;
  /** Abstract role label. */
  readonly label: string;
  /** Days to reach baseline operational competency on this role. */
  readonly daysToCompetency: number;
  /** True if a written onboarding artifact exists for the role. */
  readonly hasWrittenOnboarding: boolean;
  /** True if shadowing with the incumbent is currently feasible. */
  readonly shadowingFeasible: boolean;
}

export type OnboardingFragilityBand =
  | 'durable'
  | 'observed'
  | 'fragile'
  | 'critical';

export interface OnboardingFragilityRole {
  readonly id: string;
  readonly label: string;
  readonly fragility: OnboardingFragilityBand;
  readonly score: number;
  readonly reading: string;
}

export interface OnboardingSurvivabilityLayer {
  readonly roles: readonly OnboardingFragilityRole[];
  readonly criticalCount: number;
  readonly fragileCount: number;
  readonly meanScore: number;
  readonly reading: string;
}

export function analyzeOnboardingFragility(
  roles: readonly OnboardingRoleInput[],
): OnboardingSurvivabilityLayer {
  const analyzed: OnboardingFragilityRole[] = roles.map((r) => {
    const score = computeScore(r);
    const band = classifyBand(score);
    return {
      id: r.id,
      label: r.label,
      fragility: band,
      score: round2(score),
      reading: posturalStatement(band, r),
    };
  });

  const criticalCount = analyzed.filter((r) => r.fragility === 'critical').length;
  const fragileCount = analyzed.filter((r) => r.fragility === 'fragile').length;
  const meanScore =
    analyzed.length === 0
      ? 0
      : round2(analyzed.reduce((a, r) => a + r.score, 0) / analyzed.length);

  return {
    roles: analyzed,
    criticalCount,
    fragileCount,
    meanScore,
    reading: aggregateReading(meanScore, criticalCount, fragileCount, analyzed.length),
  };
}

function computeScore(r: OnboardingRoleInput): number {
  let score = 0;
  // Days-to-competency normalized: 30d → 0.1, 90d → 0.3, 180d → 0.6, 365d+ → 1.0
  score += Math.min(1, r.daysToCompetency / 365) * 0.5;
  if (!r.hasWrittenOnboarding) score += 0.3;
  if (!r.shadowingFeasible) score += 0.3;
  return Math.min(1, score);
}

function classifyBand(score: number): OnboardingFragilityBand {
  if (score >= 0.7) return 'critical';
  if (score >= 0.5) return 'fragile';
  if (score >= 0.3) return 'observed';
  return 'durable';
}

function posturalStatement(band: OnboardingFragilityBand, r: OnboardingRoleInput): string {
  switch (band) {
    case 'critical':
      return `Onboarding for this role is critically fragile (${r.daysToCompetency}d to competency${r.hasWrittenOnboarding ? '' : ', no written onboarding'}${r.shadowingFeasible ? '' : ', shadowing not feasible'}).`;
    case 'fragile':
      return `Onboarding for this role is fragile (${r.daysToCompetency}d to competency${r.hasWrittenOnboarding ? '' : ', no written onboarding'}).`;
    case 'observed':
      return `Onboarding for this role is observed but uneven (${r.daysToCompetency}d to competency).`;
    case 'durable':
      return `Onboarding for this role is durable (${r.daysToCompetency}d to competency, written onboarding and shadowing in place).`;
  }
}

function aggregateReading(
  meanScore: number,
  criticalCount: number,
  fragileCount: number,
  total: number,
): string {
  if (total === 0) {
    return 'Onboarding fragility has not been assessed for any role yet.';
  }
  if (criticalCount >= 1) {
    return `${criticalCount} role${criticalCount === 1 ? ' has' : 's have'} critical onboarding fragility; new carriers cannot absorb practice fast enough to prevent quiet continuity failure.`;
  }
  if (fragileCount >= 2) {
    return `${fragileCount} roles show fragile onboarding; appropriate to invest in written practice and shadowing.`;
  }
  if (meanScore <= 0.25) {
    return 'Onboarding survivability appears durable across the named roles.';
  }
  return 'Onboarding survivability is observed but uneven across the named roles.';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
