/**
 * OCI Benchmark Intelligence — barrel.
 */

export type {
  AggregateIntake,
  AggregateResult,
  GovernanceShape,
  InstitutionalSectorId,
  PressureProfile,
  RegulatoryProfile,
  SectorAggregate,
  SectorBaseline,
  SectorRange,
  StewardshipBurdenCategory,
  StewardshipBurdenPattern,
  StewardshipBurdenPatternId,
} from './types';

export { SECTOR_BASELINES, SECTOR_BASELINES_BY_ID } from './sectorBaselines';

export {
  STEWARDSHIP_BURDEN_PATTERNS,
  STEWARDSHIP_BURDEN_PATTERNS_BY_CATEGORY,
  STEWARDSHIP_BURDEN_PATTERNS_BY_ID,
} from './stewardshipBurdenPatterns';

export {
  BoundaryBreachError,
  K_ANONYMITY_THRESHOLD,
  aggregateBySector,
  assertNoIndividualIdentifiers,
  selectOptedIn,
} from './aggregateIntelligence';
export type { AggregationOptions } from './aggregateIntelligence';

export {
  BENCHMARK_PUBLICATION_GUARD_VERSION,
  COHORT_MINIMUM,
  FORBIDDEN_CLAIM_FORMS,
  MIN_TREND_PERIODS,
  SAFE_CLAIM_FORMS,
  guardBenchmarkClaim,
  guardBenchmarkClaims,
  isPublishable,
} from './publicationGuard';
export type {
  BenchmarkClaim,
  BenchmarkClaimForm,
  BenchmarkClaimKind,
  CohortDescriptor,
  GuardViolation,
  PublicationDecision,
  PublicationVerdict,
  TrendPeriod,
  ViolationCode,
} from './publicationGuard';
