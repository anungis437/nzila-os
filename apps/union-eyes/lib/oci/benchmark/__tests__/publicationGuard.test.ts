/**
 * OCI / OCRA Benchmark Publication Guard — tests.
 *
 * Proves the publication discipline from
 * docs/oci/superseded/government-readiness/OCI_OCRA_BENCHMARK_GOVERNANCE_REVIEW.md:
 *  - cohort floors (§3) suppress thin slices,
 *  - forbidden claim forms (§4.2) are rejected outright,
 *  - the honesty clause (§4.3) is mandatory,
 *  - suppression is the default and publication is earned,
 *  - the guard never imports the scoring engine.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_PUBLICATION_GUARD_VERSION,
  COHORT_MINIMUM,
  FORBIDDEN_CLAIM_FORMS,
  guardBenchmarkClaim,
  guardBenchmarkClaims,
  isPublishable,
  type BenchmarkClaim,
} from '../publicationGuard';
import { K_ANONYMITY_THRESHOLD } from '../aggregateIntelligence';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD_FILE = resolve(HERE, '../publicationGuard.ts');

function claim(overrides: Partial<BenchmarkClaim> = {}): BenchmarkClaim {
  return {
    claimId: 'c1',
    kind: 'sector-characteristic-range',
    form: 'characteristic-range',
    cohort: { totalN: 25, distinctK: 25 },
    honestyClauseAttached: true,
    ...overrides,
  };
}

describe('benchmark publication guard — cohort floors (§3)', () => {
  it('publishes a well-formed, cohort-backed characteristic range', () => {
    const verdict = guardBenchmarkClaim(claim());
    expect(verdict.decision).toBe('publish');
    expect(verdict.violations).toHaveLength(0);
    expect(verdict.guardVersion).toBe(BENCHMARK_PUBLICATION_GUARD_VERSION);
  });

  it('suppresses a sector range below N ≥ 20', () => {
    const verdict = guardBenchmarkClaim(
      claim({ cohort: { totalN: COHORT_MINIMUM - 1, distinctK: 19 } }),
    );
    expect(verdict.decision).toBe('suppress');
    expect(verdict.violations.map((v) => v.code)).toContain('BELOW_COHORT_MINIMUM');
  });

  it('suppresses a published aggregate below K ≥ 5', () => {
    const verdict = guardBenchmarkClaim(
      claim({
        kind: 'published-aggregate',
        form: 'evidence-level-aggregate',
        cohort: { totalN: 4, distinctK: K_ANONYMITY_THRESHOLD - 1 },
      }),
    );
    expect(verdict.decision).toBe('suppress');
    expect(verdict.violations.map((v) => v.code)).toContain('BELOW_K_ANONYMITY');
  });

  it('requires N ≥ 20 in every sector of a cross-sector comparison', () => {
    const ok = guardBenchmarkClaim(
      claim({ kind: 'cross-sector-comparison', cohort: { totalN: 60, distinctK: 60, perSectorN: [30, 30] } }),
    );
    expect(ok.decision).toBe('publish');

    const thin = guardBenchmarkClaim(
      claim({ kind: 'cross-sector-comparison', cohort: { totalN: 35, distinctK: 35, perSectorN: [30, 5] } }),
    );
    expect(thin.decision).toBe('suppress');
    expect(thin.violations.map((v) => v.code)).toContain('CROSS_SECTOR_THIN_SLICE');

    const single = guardBenchmarkClaim(
      claim({ kind: 'cross-sector-comparison', cohort: { totalN: 30, distinctK: 30, perSectorN: [30] } }),
    );
    expect(single.decision).toBe('suppress');
    expect(single.violations.map((v) => v.code)).toContain('CROSS_SECTOR_THIN_SLICE');
  });

  it('requires both N ≥ 20 and K ≥ 5 for a sub-sector / regional cut', () => {
    const verdict = guardBenchmarkClaim(
      claim({ kind: 'subsector-regional-cut', cohort: { totalN: 10, distinctK: 3 } }),
    );
    expect(verdict.decision).toBe('suppress');
    const codes = verdict.violations.map((v) => v.code);
    expect(codes).toContain('BELOW_COHORT_MINIMUM');
    expect(codes).toContain('BELOW_K_ANONYMITY');
  });

  it('requires ≥ 3 periods, each N ≥ 20, for a time-trend statement', () => {
    const ok = guardBenchmarkClaim(
      claim({
        kind: 'time-trend',
        cohort: {
          totalN: 60,
          distinctK: 60,
          periods: [
            { periodId: '2023', n: 20 },
            { periodId: '2024', n: 22 },
            { periodId: '2025', n: 25 },
          ],
        },
      }),
    );
    expect(ok.decision).toBe('publish');

    const tooFew = guardBenchmarkClaim(
      claim({
        kind: 'time-trend',
        cohort: { totalN: 40, distinctK: 40, periods: [{ periodId: '2024', n: 25 }, { periodId: '2025', n: 25 }] },
      }),
    );
    expect(tooFew.violations.map((v) => v.code)).toContain('INSUFFICIENT_TREND_PERIODS');

    const thinPeriod = guardBenchmarkClaim(
      claim({
        kind: 'time-trend',
        cohort: {
          totalN: 50,
          distinctK: 50,
          periods: [
            { periodId: '2023', n: 25 },
            { periodId: '2024', n: 5 },
            { periodId: '2025', n: 25 },
          ],
        },
      }),
    );
    expect(thinPeriod.violations.map((v) => v.code)).toContain('TREND_PERIOD_BELOW_MINIMUM');
  });
});

describe('benchmark publication guard — forbidden forms (§4.2)', () => {
  it('rejects every forbidden form regardless of cohort size', () => {
    for (const form of FORBIDDEN_CLAIM_FORMS) {
      const verdict = guardBenchmarkClaim(
        claim({ form, cohort: { totalN: 1000, distinctK: 1000 } }),
      );
      expect(verdict.decision).toBe('suppress');
      expect(verdict.violations.map((v) => v.code)).toContain('FORBIDDEN_CLAIM_FORM');
    }
  });
});

describe('benchmark publication guard — honesty clause (§4.3)', () => {
  it('suppresses an otherwise-valid claim missing its honesty clause', () => {
    const verdict = guardBenchmarkClaim(claim({ honestyClauseAttached: false }));
    expect(verdict.decision).toBe('suppress');
    expect(verdict.violations.map((v) => v.code)).toContain('MISSING_HONESTY_CLAUSE');
  });
});

describe('benchmark publication guard — behaviour & isolation', () => {
  it('reports every violation rather than short-circuiting', () => {
    const verdict = guardBenchmarkClaim(
      claim({
        kind: 'subsector-regional-cut',
        form: 'ranking',
        cohort: { totalN: 3, distinctK: 2 },
        honestyClauseAttached: false,
      }),
    );
    const codes = verdict.violations.map((v) => v.code);
    expect(codes).toContain('FORBIDDEN_CLAIM_FORM');
    expect(codes).toContain('BELOW_COHORT_MINIMUM');
    expect(codes).toContain('BELOW_K_ANONYMITY');
    expect(codes).toContain('MISSING_HONESTY_CLAUSE');
  });

  it('isPublishable and the batch guard agree with the single guard', () => {
    const good = claim();
    const bad = claim({ honestyClauseAttached: false });
    expect(isPublishable(good)).toBe(true);
    expect(isPublishable(bad)).toBe(false);
    const verdicts = guardBenchmarkClaims([good, bad]);
    expect(verdicts.map((v) => v.decision)).toStrictEqual(['publish', 'suppress']);
    expect(verdicts[0]!.claimId).toBe('c1');
  });

  it('is deterministic and JSON-serializable', () => {
    const c = claim({ kind: 'time-trend', cohort: { totalN: 10, distinctK: 4, periods: [] } });
    const a = guardBenchmarkClaim(c);
    const b = guardBenchmarkClaim(c);
    expect(a).toStrictEqual(b);
    expect(() => JSON.stringify(a)).not.toThrow();
  });

  it('does not import the scoring engine', () => {
    const src = readFileSync(GUARD_FILE, 'utf8');
    expect(src).not.toMatch(/from ['"].*\/scoring['"]/);
    expect(src).not.toMatch(/scoreAssessment|computeProfile/);
  });
});
