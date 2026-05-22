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
