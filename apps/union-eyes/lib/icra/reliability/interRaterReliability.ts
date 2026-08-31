/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Inter-Rater Reliability (stats)
 * MODULE: OCI/OCRA IRR statistics engine (Phase C)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure, deterministic statistics for measuring agreement between independent
 * reviewers. Domain-free: operates on category indices and numeric matrices.
 *
 * CONSTITUTIONAL CONSTRAINT: this module MEASURES reviewers; it never overrides
 * a reviewer and never touches a score. It does not import the scoring engine.
 * Reliability is improved by training/calibration, not by automating judgment.
 *
 * Honesty: every estimator returns `null` when the data cannot support it
 * (e.g. a degenerate single-category distribution, or too few subjects). We
 * never fabricate an agreement coefficient from insufficient data.
 */

/** Landis & Koch (1977) ordinal interpretation of an agreement coefficient. */
export type AgreementStrength =
  | 'poor'
  | 'slight'
  | 'fair'
  | 'moderate'
  | 'substantial'
  | 'almost_perfect'
  | 'undefined';

export function interpretAgreement(kappa: number | null): AgreementStrength {
  if (kappa == null || !Number.isFinite(kappa)) return 'undefined';
  if (kappa < 0.0) return 'poor';
  if (kappa < 0.2) return 'slight';
  if (kappa < 0.4) return 'fair';
  if (kappa < 0.6) return 'moderate';
  if (kappa < 0.8) return 'substantial';
  return 'almost_perfect';
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

/** A paired observation: two raters' category indices for one item. */
export type Pair = readonly [a: number, b: number];

/**
 * Cohen's κ for two raters over nominal categories.
 * Returns `null` when agreement is undefined (e.g. both raters used a single
 * category for everything → expected agreement = 1).
 */
export function cohenKappa(pairs: readonly Pair[], categories: number): number | null {
  const n = pairs.length;
  if (n === 0 || categories < 2) return null;

  const observed = pairs.filter(([a, b]) => a === b).length / n;

  const marginA = new Array<number>(categories).fill(0);
  const marginB = new Array<number>(categories).fill(0);
  for (const [a, b] of pairs) {
    if (a < 0 || a >= categories || b < 0 || b >= categories) return null;
    marginA[a] += 1;
    marginB[b] += 1;
  }

  let expected = 0;
  for (let k = 0; k < categories; k += 1) {
    expected += (marginA[k] / n) * (marginB[k] / n);
  }

  if (expected >= 1) return null; // perfectly concentrated → κ undefined
  return round4((observed - expected) / (1 - expected));
}

/**
 * Weighted κ for two raters over ORDINAL categories.
 * Disagreement weights: linear `|i-j|/(k-1)` or quadratic `((i-j)/(k-1))^2`.
 */
export function weightedKappa(
  pairs: readonly Pair[],
  categories: number,
  weighting: 'linear' | 'quadratic' = 'linear',
): number | null {
  const n = pairs.length;
  if (n === 0 || categories < 2) return null;

  const denom = categories - 1;
  const weight = (i: number, j: number): number => {
    const d = Math.abs(i - j) / denom;
    return weighting === 'quadratic' ? d * d : d;
  };

  const marginA = new Array<number>(categories).fill(0);
  const marginB = new Array<number>(categories).fill(0);
  const observedMatrix: number[][] = Array.from({ length: categories }, () =>
    new Array<number>(categories).fill(0),
  );
  for (const [a, b] of pairs) {
    if (a < 0 || a >= categories || b < 0 || b >= categories) return null;
    marginA[a] += 1;
    marginB[b] += 1;
    observedMatrix[a][b] += 1;
  }

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < categories; i += 1) {
    for (let j = 0; j < categories; j += 1) {
      const w = weight(i, j);
      const observed = observedMatrix[i][j] / n;
      const expected = (marginA[i] / n) * (marginB[j] / n);
      numerator += w * observed;
      denominator += w * expected;
    }
  }

  if (denominator === 0) return null; // no expected disagreement → undefined
  return round4(1 - numerator / denominator);
}

/**
 * Fleiss' κ for a fixed number of raters per item over nominal categories.
 * `counts[i][j]` = number of raters who assigned item i to category j.
 * Every row must sum to the same rater count N (≥2).
 */
export function fleissKappa(counts: readonly (readonly number[])[]): number | null {
  const nItems = counts.length;
  if (nItems === 0) return null;
  const categories = counts[0].length;
  if (categories < 2) return null;

  const raters = counts[0].reduce((a, b) => a + b, 0);
  if (raters < 2) return null;
  for (const row of counts) {
    if (row.length !== categories) return null;
    if (row.reduce((a, b) => a + b, 0) !== raters) return null; // unequal rater counts unsupported
  }

  // Per-item agreement P_i.
  let sumPi = 0;
  for (const row of counts) {
    let sumSq = 0;
    for (const c of row) sumSq += c * c;
    sumPi += (sumSq - raters) / (raters * (raters - 1));
  }
  const pBar = sumPi / nItems;

  // Category proportions p_j and expected agreement P_e.
  const total = nItems * raters;
  let pe = 0;
  for (let j = 0; j < categories; j += 1) {
    let colSum = 0;
    for (const row of counts) colSum += row[j];
    const pj = colSum / total;
    pe += pj * pj;
  }

  if (pe >= 1) return null;
  return round4((pBar - pe) / (1 - pe));
}

/**
 * ICC(2,1) — two-way random effects, single rater, absolute agreement.
 * `matrix[subject][rater]` of continuous scores. Requires ≥2 subjects, ≥2 raters,
 * fully crossed (every rater scores every subject).
 */
export function icc21(matrix: readonly (readonly number[])[]): number | null {
  const n = matrix.length; // subjects
  if (n < 2) return null;
  const k = matrix[0].length; // raters
  if (k < 2) return null;
  for (const row of matrix) {
    if (row.length !== k) return null;
  }

  const flat: number[] = [];
  for (const row of matrix) for (const v of row) flat.push(v);
  const grand = flat.reduce((a, b) => a + b, 0) / flat.length;

  const rowMeans = matrix.map((row) => row.reduce((a, b) => a + b, 0) / k);
  const colMeans: number[] = new Array<number>(k).fill(0);
  for (let j = 0; j < k; j += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += matrix[i][j];
    colMeans[j] = s / n;
  }

  let sst = 0;
  for (const v of flat) sst += (v - grand) * (v - grand);
  let ssr = 0;
  for (const rm of rowMeans) ssr += (rm - grand) * (rm - grand);
  ssr *= k;
  let ssc = 0;
  for (const cm of colMeans) ssc += (cm - grand) * (cm - grand);
  ssc *= n;
  const sse = sst - ssr - ssc;

  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));

  const denominator = msr + (k - 1) * mse + (k / n) * (msc - mse);
  if (denominator === 0) return null;
  return round4((msr - mse) / denominator);
}

export interface BandAgreement {
  /** Fraction of rater pairs assigning the exact same band. */
  readonly exact: number;
  /** Fraction of rater pairs within one band of each other. */
  readonly withinOne: number;
  /** Number of (subject, rater-pair) comparisons used. */
  readonly comparisons: number;
}

/**
 * Band agreement over an ordinal band index matrix `[subject][rater]`.
 * Averages over all unordered rater pairs per subject.
 */
export function bandAgreement(
  matrix: readonly (readonly number[])[],
): BandAgreement | null {
  let exactHits = 0;
  let withinOneHits = 0;
  let comparisons = 0;

  for (const row of matrix) {
    for (let i = 0; i < row.length; i += 1) {
      for (let j = i + 1; j < row.length; j += 1) {
        const diff = Math.abs(row[i] - row[j]);
        if (diff === 0) exactHits += 1;
        if (diff <= 1) withinOneHits += 1;
        comparisons += 1;
      }
    }
  }

  if (comparisons === 0) return null;
  return Object.freeze({
    exact: round4(exactHits / comparisons),
    withinOne: round4(withinOneHits / comparisons),
    comparisons,
  });
}
