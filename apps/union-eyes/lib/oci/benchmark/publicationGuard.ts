/**
 * OCI / OCRA Benchmark Publication Guard.
 *
 * Codifies the benchmark publication discipline defined in
 * docs/oci/superseded/government-readiness/OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md
 * (§3 minimum cohorts, §4 safe/unsafe claim catalogue, §7 honesty clause).
 *
 * Pure, deterministic, no I/O, no scoring import. This guard NEVER produces a
 * benchmark number and never touches a score. It only decides whether a
 * *proposed* benchmark statement is safe to publish. Suppression is the default;
 * publication is earned by meeting every applicable floor.
 *
 * Doctrine constraints (binding):
 *  - K ≥ 5 (k-anonymity) for any published aggregate.
 *  - N ≥ 20 for a sector characteristic range, per-sector for cross-sector,
 *    and per-period for a time trend (≥ 3 periods).
 *  - Below threshold ⇒ suppress the number entirely; never a degraded estimate.
 *  - Ranking / normative-grade / probability claim forms are forbidden outright,
 *    regardless of cohort size.
 *  - Every publishable claim must carry its honesty clause (cohort size,
 *    evidence basis, "characteristic not normative" caveat).
 */

import { K_ANONYMITY_THRESHOLD } from './aggregateIntelligence';

export const BENCHMARK_PUBLICATION_GUARD_VERSION = '1.0.0' as const;

/**
 * Minimum distinct-institution cohort below which a "typical range" is noise
 * (doctrine §3). Callers may raise it; they may not lower it.
 */
export const COHORT_MINIMUM = 20 as const;

/** Minimum number of periods before a time-trend statement is permitted. */
export const MIN_TREND_PERIODS = 3 as const;

/**
 * The kind of benchmark cut being proposed. Each kind carries its own cohort
 * floor (doctrine §3).
 */
export type BenchmarkClaimKind =
  | 'published-aggregate'
  | 'sector-characteristic-range'
  | 'cross-sector-comparison'
  | 'subsector-regional-cut'
  | 'time-trend';

/**
 * The rhetorical form of the statement. Safe forms describe characteristics and
 * patterns; forbidden forms imply league tables, grades, or predictions
 * (doctrine §4.1 / §4.2).
 */
export type BenchmarkClaimForm =
  // Safe forms
  | 'characteristic-range'
  | 'pattern-frequency'
  | 'evidence-level-aggregate'
  // Forbidden forms
  | 'ranking'
  | 'normative-grade'
  | 'probability-claim';

export const SAFE_CLAIM_FORMS: ReadonlySet<BenchmarkClaimForm> = new Set([
  'characteristic-range',
  'pattern-frequency',
  'evidence-level-aggregate',
]);

export const FORBIDDEN_CLAIM_FORMS: ReadonlySet<BenchmarkClaimForm> = new Set([
  'ranking',
  'normative-grade',
  'probability-claim',
]);

export interface TrendPeriod {
  readonly periodId: string;
  /** Distinct institutions contributing to this period. */
  readonly n: number;
}

/**
 * Describes the cohort backing a proposed claim. All counts are distinct
 * institutions, never raw intake counts.
 */
export interface CohortDescriptor {
  /** Distinct contributing institutions across the whole claim. */
  readonly totalN: number;
  /** k-anonymity contributing count for the published cell. */
  readonly distinctK: number;
  /** Per-sector distinct-institution counts (cross-sector comparison only). */
  readonly perSectorN?: readonly number[];
  /** Period descriptors (time-trend only). */
  readonly periods?: readonly TrendPeriod[];
}

export interface BenchmarkClaim {
  readonly claimId: string;
  readonly kind: BenchmarkClaimKind;
  readonly form: BenchmarkClaimForm;
  readonly cohort: CohortDescriptor;
  /**
   * Whether the honesty clause (cohort size, evidence basis, characteristic-not-
   * normative caveat) is attached. Doctrine §4.3: a benchmark without its
   * limitations attached is an unsafe claim.
   */
  readonly honestyClauseAttached: boolean;
}

export type ViolationCode =
  | 'FORBIDDEN_CLAIM_FORM'
  | 'BELOW_K_ANONYMITY'
  | 'BELOW_COHORT_MINIMUM'
  | 'CROSS_SECTOR_THIN_SLICE'
  | 'INSUFFICIENT_TREND_PERIODS'
  | 'TREND_PERIOD_BELOW_MINIMUM'
  | 'MISSING_HONESTY_CLAUSE';

export interface GuardViolation {
  readonly code: ViolationCode;
  readonly message: string;
}

export type PublicationDecision = 'publish' | 'suppress';

export interface PublicationVerdict {
  readonly claimId: string;
  readonly decision: PublicationDecision;
  readonly violations: readonly GuardViolation[];
  readonly guardVersion: typeof BENCHMARK_PUBLICATION_GUARD_VERSION;
}

function violation(code: ViolationCode, message: string): GuardViolation {
  return { code, message };
}

/**
 * Evaluate a single proposed benchmark claim against the publication discipline.
 *
 * Returns a verdict listing every violation (the guard does not short-circuit, so
 * a reviewer sees all reasons a claim is held). `decision` is `suppress` whenever
 * any violation is present — suppression is the default and publication is earned.
 */
export function guardBenchmarkClaim(claim: BenchmarkClaim): PublicationVerdict {
  const violations: GuardViolation[] = [];

  // §4.2 — forbidden forms are rejected outright, regardless of cohort.
  if (FORBIDDEN_CLAIM_FORMS.has(claim.form)) {
    violations.push(
      violation(
        'FORBIDDEN_CLAIM_FORM',
        `Claim form "${claim.form}" is forbidden: it implies a league table, ` +
          `normative grade, or predictive probability the method never makes.`,
      ),
    );
  }

  const { cohort } = claim;

  // §3 — cohort floors, by claim kind.
  switch (claim.kind) {
    case 'published-aggregate': {
      if (cohort.distinctK < K_ANONYMITY_THRESHOLD) {
        violations.push(
          violation(
            'BELOW_K_ANONYMITY',
            `Published aggregate requires K ≥ ${K_ANONYMITY_THRESHOLD}; cohort has K = ${cohort.distinctK}.`,
          ),
        );
      }
      break;
    }
    case 'sector-characteristic-range': {
      if (cohort.totalN < COHORT_MINIMUM) {
        violations.push(
          violation(
            'BELOW_COHORT_MINIMUM',
            `Sector characteristic range requires N ≥ ${COHORT_MINIMUM}; cohort has N = ${cohort.totalN}.`,
          ),
        );
      }
      break;
    }
    case 'cross-sector-comparison': {
      const perSector = cohort.perSectorN ?? [];
      if (perSector.length < 2) {
        violations.push(
          violation(
            'CROSS_SECTOR_THIN_SLICE',
            `Cross-sector comparison requires at least two sectors with per-sector N.`,
          ),
        );
      }
      for (const [i, n] of perSector.entries()) {
        if (n < COHORT_MINIMUM) {
          violations.push(
            violation(
              'CROSS_SECTOR_THIN_SLICE',
              `Cross-sector comparison requires N ≥ ${COHORT_MINIMUM} per sector; ` +
                `sector index ${i} has N = ${n}.`,
            ),
          );
        }
      }
      break;
    }
    case 'subsector-regional-cut': {
      if (cohort.totalN < COHORT_MINIMUM) {
        violations.push(
          violation(
            'BELOW_COHORT_MINIMUM',
            `Sub-sector / regional cut requires N ≥ ${COHORT_MINIMUM}; cohort has N = ${cohort.totalN}.`,
          ),
        );
      }
      if (cohort.distinctK < K_ANONYMITY_THRESHOLD) {
        violations.push(
          violation(
            'BELOW_K_ANONYMITY',
            `Sub-sector / regional cut requires K ≥ ${K_ANONYMITY_THRESHOLD}; cohort has K = ${cohort.distinctK}.`,
          ),
        );
      }
      break;
    }
    case 'time-trend': {
      const periods = cohort.periods ?? [];
      if (periods.length < MIN_TREND_PERIODS) {
        violations.push(
          violation(
            'INSUFFICIENT_TREND_PERIODS',
            `Time-trend statement requires ≥ ${MIN_TREND_PERIODS} periods; cohort has ${periods.length}.`,
          ),
        );
      }
      for (const period of periods) {
        if (period.n < COHORT_MINIMUM) {
          violations.push(
            violation(
              'TREND_PERIOD_BELOW_MINIMUM',
              `Time-trend period "${period.periodId}" requires N ≥ ${COHORT_MINIMUM}; has N = ${period.n}.`,
            ),
          );
        }
      }
      break;
    }
  }

  // §4.3 — the honesty clause is mandatory for any publishable claim.
  if (!claim.honestyClauseAttached) {
    violations.push(
      violation(
        'MISSING_HONESTY_CLAUSE',
        `Claim is missing its honesty clause (cohort size, evidence basis, and the ` +
          `characteristic-not-normative caveat). Doctrine §4.3.`,
      ),
    );
  }

  return {
    claimId: claim.claimId,
    decision: violations.length === 0 ? 'publish' : 'suppress',
    violations,
    guardVersion: BENCHMARK_PUBLICATION_GUARD_VERSION,
  };
}

/**
 * Evaluate a batch of proposed claims. Deterministic; preserves input order.
 */
export function guardBenchmarkClaims(
  claims: readonly BenchmarkClaim[],
): readonly PublicationVerdict[] {
  return claims.map(guardBenchmarkClaim);
}

/** True only when the claim may be published with no reservations. */
export function isPublishable(claim: BenchmarkClaim): boolean {
  return guardBenchmarkClaim(claim).decision === 'publish';
}
