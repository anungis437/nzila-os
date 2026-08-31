/**
 * OCI Benchmark Intelligence — opt-in aggregate intelligence pipeline.
 *
 * Pure functions. No I/O. No persistence. No network calls.
 *
 * The pipeline enforces three doctrine guarantees:
 *
 *  G1. Opt-in only.   Intakes without `aggregateOptIn === true` are
 *      removed at the first stage and never reach aggregation.
 *
 *  G2. K-anonymity.   No sector aggregate is returned unless the
 *      contributing institution count meets or exceeds the configured
 *      minimum k. Below-k sectors are reported as suppressed, with a
 *      reason, so suppression itself is visible.
 *
 *  G3. No individual signals.  Intakes are screened at the boundary
 *      for fields that would constitute individual-level identifiers.
 *      A rejection throws — the pipeline must not silently swallow a
 *      boundary breach.
 *
 * Doctrine sources:
 *  - docs/oci/OCI_METHOD.md (Sections 3.6, 3.7, 6.5)
 *  - docs/oci/OCI_AI_BOUNDARY.md
 *  - docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md
 *  - docs/oci/OCI_DATA_HANDLING.md
 */

import type {
  AggregateIntake,
  AggregateResult,
  InstitutionalSectorId,
  SectorAggregate,
  SectorRange,
  StewardshipBurdenPatternId,
} from './types';

/**
 * Minimum number of distinct institutions required before any
 * aggregate cell may be returned. Five is the doctrinal default;
 * callers may raise it but may not lower it.
 */
export const K_ANONYMITY_THRESHOLD = 5 as const;

/**
 * Field names that are categorically forbidden in an aggregate intake.
 * Any intake containing one of these keys is treated as a boundary
 * breach and rejected.
 */
const FORBIDDEN_INTAKE_KEYS: ReadonlySet<string> = new Set([
  // Person-level identifiers
  'name',
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'address',
  'employeeId',
  'memberId',
  // Role-tied-to-person identifiers
  'chairName',
  'stewardName',
  'facilitatorName',
  'sponsorName',
  // Free-text fields capable of carrying individual context
  'notes',
  'comments',
  'narrative',
]);

export class BoundaryBreachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryBreachError';
  }
}

/**
 * Guard at the pipeline boundary. Throws BoundaryBreachError if the
 * intake carries any forbidden field.
 *
 * The intake is typed as AggregateIntake, but the guard inspects the
 * runtime object so that callers cannot defeat the boundary by
 * widening the type.
 */
export function assertNoIndividualIdentifiers(
  intake: AggregateIntake,
): void {
  const keys = Object.keys(intake) as readonly string[];
  for (const key of keys) {
    if (FORBIDDEN_INTAKE_KEYS.has(key)) {
      throw new BoundaryBreachError(
        `Aggregate intake contains forbidden field "${key}". ` +
          `Individual-level identifiers are not permitted at any layer.`,
      );
    }
  }
  // Defensive: aggregateOptIn must be an explicit boolean, never
  // truthy-by-accident.
  if (typeof intake.aggregateOptIn !== 'boolean') {
    throw new BoundaryBreachError(
      'Aggregate intake requires an explicit boolean aggregateOptIn flag.',
    );
  }
  if (typeof intake.optInRecordedAt !== 'string' || intake.optInRecordedAt.length === 0) {
    throw new BoundaryBreachError(
      'Aggregate intake requires a non-empty optInRecordedAt timestamp.',
    );
  }
}

/**
 * Filter for explicit opt-in. Intakes without a true
 * `aggregateOptIn` flag are removed.
 */
export function selectOptedIn(
  intakes: readonly AggregateIntake[],
): readonly AggregateIntake[] {
  return intakes.filter((intake) => intake.aggregateOptIn === true);
}

function groupBy<K extends string>(
  items: readonly AggregateIntake[],
  key: (item: AggregateIntake) => K,
): Map<K, AggregateIntake[]> {
  const out = new Map<K, AggregateIntake[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) {
      bucket.push(item);
    } else {
      out.set(k, [item]);
    }
  }
  return out;
}

function range(values: readonly number[]): SectorRange {
  // Pre-sorted; the caller passes raw values.
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // Low/high reported as inter-quartile bounds (25th/75th percentile)
  // rather than min/max, to avoid letting extremes act as identifiers.
  const idx = (p: number) =>
    Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))));
  const median =
    n % 2 === 1
      ? sorted[(n - 1) / 2]!
      : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return {
    low: sorted[idx(0.25)]!,
    median,
    high: sorted[idx(0.75)]!,
  };
}

function patternFrequencies(
  intakes: readonly AggregateIntake[],
): Readonly<Partial<Record<StewardshipBurdenPatternId, number>>> {
  const counts = new Map<StewardshipBurdenPatternId, number>();
  for (const intake of intakes) {
    // Deduplicate within a single intake so that the contributor count
    // determines the denominator, not the intake's own multiplicity.
    const unique = new Set(intake.presentBurdenPatternIds);
    for (const id of unique) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const denominator = intakes.length;
  const out: Partial<Record<StewardshipBurdenPatternId, number>> = {};
  for (const [id, count] of counts.entries()) {
    out[id] = count / denominator;
  }
  return Object.freeze(out);
}

export interface AggregationOptions {
  /** Override the default k-anonymity threshold (must be >= default). */
  readonly minimumK?: number;
  /** Clock injection for deterministic timestamps in tests. */
  readonly now?: () => Date;
}

/**
 * Aggregate intakes by sector under the doctrine's three guarantees.
 *
 * The function performs the following pipeline in order:
 *   1. boundary check on every intake (G3)
 *   2. opt-in filter (G1)
 *   3. group by sector
 *   4. suppress any sector whose count is below the minimum k (G2)
 *   5. compute aggregate stats for surviving sectors
 *
 * Returns both the surviving aggregates and the suppressed sectors so
 * that suppression is visible to the caller.
 */
export function aggregateBySector(
  intakes: readonly AggregateIntake[],
  options: AggregationOptions = {},
): AggregateResult {
  const minimumK = options.minimumK ?? K_ANONYMITY_THRESHOLD;
  if (minimumK < K_ANONYMITY_THRESHOLD) {
    throw new BoundaryBreachError(
      `minimumK ${minimumK} is below the doctrinal threshold ${K_ANONYMITY_THRESHOLD}.`,
    );
  }
  const now = options.now ?? (() => new Date());

  for (const intake of intakes) {
    assertNoIndividualIdentifiers(intake);
  }

  const optedIn = selectOptedIn(intakes);

  const bySector = groupBy<InstitutionalSectorId>(
    optedIn,
    (i) => i.sectorId,
  );

  const aggregates: SectorAggregate[] = [];
  const suppressedSectors: Array<{
    readonly sectorId: InstitutionalSectorId;
    readonly contributingInstitutionCount: number;
    readonly reason: 'below-k-anonymity-threshold';
  }> = [];

  for (const [sectorId, sectorIntakes] of bySector.entries()) {
    // Distinct contributor count, not raw intake count.
    const distinctContributors = new Set(
      sectorIntakes.map((i) => i.institutionId),
    );
    const count = distinctContributors.size;
    if (count < minimumK) {
      suppressedSectors.push({
        sectorId,
        contributingInstitutionCount: count,
        reason: 'below-k-anonymity-threshold',
      });
      continue;
    }
    // Use one intake per distinct institution (the latest by
    // optInRecordedAt) to avoid over-weighting institutions that
    // submitted multiple intakes.
    const latestByInstitution = new Map<string, AggregateIntake>();
    for (const intake of sectorIntakes) {
      const current = latestByInstitution.get(intake.institutionId);
      if (
        !current ||
        intake.optInRecordedAt > current.optInRecordedAt
      ) {
        latestByInstitution.set(intake.institutionId, intake);
      }
    }
    const deduped = [...latestByInstitution.values()];

    aggregates.push({
      sectorId,
      contributingInstitutionCount: deduped.length,
      stewardshipDensity: range(deduped.map((i) => i.stewardshipDensity)),
      continuityFragility: range(deduped.map((i) => i.continuityFragility)),
      burdenPatternCount: range(deduped.map((i) => i.burdenPatternCount)),
      burdenPatternFrequencies: patternFrequencies(deduped),
    });
  }

  return {
    minimumKApplied: minimumK,
    returnedAt: now().toISOString(),
    aggregates,
    suppressedSectors,
  };
}
