/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Reliability Study (Phase C)
 * MODULE: OCI/OCRA IRR study orchestration
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Aggregates paired/multi-rater observations into a version-pinned reliability
 * study: answer-selection κ, evidence-level weighted κ, composite ICC, and
 * maturity-band agreement — each judged against the doctrine's PROPOSED
 * procurement thresholds, with an honest `INSUFFICIENT` verdict when the panel
 * is too small to support a claim.
 *
 * Closes the loop with confidence: a measured disagreement on an item maps to a
 * `reviewerVariance` in [0,1] that `buildFindingConfidence` consumes to LOWER
 * (never raise) a finding's confidence.
 *
 * CONSTITUTIONAL CONSTRAINT: measurement only. No scoring import; no reviewer
 * identity in any output (raters are opaque ids); no automation of judgment.
 */

import {
  bandAgreement,
  cohenKappa,
  fleissKappa,
  icc21,
  interpretAgreement,
  weightedKappa,
  type AgreementStrength,
  type Pair,
} from './interRaterReliability';

export const RELIABILITY_STUDY_VERSION = '1.0.0';

/** Minimum panel to support any reliability CLAIM (doctrine §3.3). */
export const MIN_RATERS = 2;
export const MIN_SUBJECTS_FOR_ICC = 2;
/** Below this item/subject count, results are surfaced but marked INSUFFICIENT. */
export const MIN_ITEMS_FOR_CLAIM = 20;

/** Proposed procurement thresholds (doctrine §3.2 — targets, not attainment). */
export const THRESHOLDS = Object.freeze({
  compositeIcc: 0.8,
  bandExact: 0.7,
  bandWithinOne: 0.95,
  evidenceWeightedKappa: 0.6,
  answerKappa: 0.6,
});

/** One opaque rater's index choices. Rater identity is never a name. */
export type RaterId = string;

/** Per-question answer selections (nominal index) keyed by rater. */
export interface AnswerItem {
  readonly itemId: string;
  readonly categories: number;
  readonly ratings: Readonly<Record<RaterId, number>>;
}

/** Per-finding evidence-level selections (ordinal index 0..5) keyed by rater. */
export interface EvidenceItem {
  readonly itemId: string;
  readonly ratings: Readonly<Record<RaterId, number>>;
}

/** Per-institution composite + band, scored independently by each rater. */
export interface SubjectScoring {
  readonly subjectId: string;
  readonly composite: Readonly<Record<RaterId, number>>;
  /** Maturity band as an ordinal index keyed by rater. */
  readonly band: Readonly<Record<RaterId, number>>;
}

export interface ReliabilityStudyInput {
  readonly raters: readonly RaterId[];
  readonly answerItems?: readonly AnswerItem[];
  readonly evidenceItems?: readonly EvidenceItem[];
  readonly subjects?: readonly SubjectScoring[];
  /** Pinned for reproducibility. */
  readonly questionBankVersion?: string;
  readonly evidenceTaxonomyVersion?: string;
}

export type Verdict = 'meets' | 'below' | 'insufficient';

export interface MetricResult {
  readonly value: number | null;
  readonly strength?: AgreementStrength;
  readonly threshold: number;
  readonly verdict: Verdict;
}

export interface ReliabilityStudyResult {
  readonly studyVersion: string;
  readonly raterCount: number;
  readonly answerAgreement: MetricResult;
  readonly evidenceAgreement: MetricResult;
  readonly compositeAgreement: MetricResult;
  readonly bandExactAgreement: MetricResult;
  readonly bandWithinOneAgreement: MetricResult;
  /** Per-item reviewer variance in [0,1], to feed buildFindingConfidence. */
  readonly reviewerVarianceByItem: Readonly<Record<string, number>>;
  /** Conservative panel-wide variance (max of item variances). */
  readonly recommendedReviewerVariance: number;
  /** True only when every applicable metric meets its threshold with enough data. */
  readonly meetsProcurementFloor: boolean;
  readonly notes: readonly string[];
}

function verdictFor(
  value: number | null,
  threshold: number,
  enoughData: boolean,
): Verdict {
  if (!enoughData || value == null) return 'insufficient';
  return value >= threshold ? 'meets' : 'below';
}

/** Map two raters' agreement on one item to a variance in [0,1]. */
function pairVariance(values: readonly number[], span: number): number {
  if (values.length < 2 || span <= 0) return 0;
  let maxDiff = 0;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(values[i] - values[j]));
    }
  }
  return Math.min(1, maxDiff / span);
}

function toPairs(ratings: Readonly<Record<RaterId, number>>): Pair[] {
  const values = Object.values(ratings);
  const pairs: Pair[] = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      pairs.push([values[i], values[j]] as Pair);
    }
  }
  return pairs;
}

/**
 * Run the reliability study. Pure and deterministic. Metrics with too little
 * data are reported with an `insufficient` verdict rather than a fabricated
 * number — honesty over coverage.
 */
export function runReliabilityStudy(
  input: ReliabilityStudyInput,
): ReliabilityStudyResult {
  const raterCount = input.raters.length;
  const answerItems = input.answerItems ?? [];
  const evidenceItems = input.evidenceItems ?? [];
  const subjects = input.subjects ?? [];
  const notes: string[] = [];

  const panelOk = raterCount >= MIN_RATERS;
  if (!panelOk) notes.push(`reviewer panel below minimum (${raterCount} < ${MIN_RATERS})`);

  // --- Answer-selection agreement (nominal). Cohen's κ (2 raters) or Fleiss. ---
  let answerValue: number | null = null;
  if (panelOk && answerItems.length > 0) {
    if (raterCount === 2) {
      const allPairs: Pair[] = [];
      let categories = 0;
      for (const item of answerItems) {
        categories = Math.max(categories, item.categories);
        for (const p of toPairs(item.ratings)) allPairs.push(p);
      }
      answerValue = cohenKappa(allPairs, categories);
    } else {
      // Build per-item category-count rows for Fleiss.
      let categories = 0;
      for (const item of answerItems) categories = Math.max(categories, item.categories);
      const counts: number[][] = answerItems.map((item) => {
        const row = new Array<number>(categories).fill(0);
        for (const v of Object.values(item.ratings)) row[v] += 1;
        return row;
      });
      answerValue = fleissKappa(counts);
    }
  }
  const answerEnough = panelOk && answerItems.length >= MIN_ITEMS_FOR_CLAIM;
  if (panelOk && answerItems.length > 0 && !answerEnough) {
    notes.push(
      `answer agreement computed on ${answerItems.length} items (< ${MIN_ITEMS_FOR_CLAIM} for a claim)`,
    );
  }

  // --- Evidence-level agreement (ordinal). Weighted κ. ---
  let evidenceValue: number | null = null;
  if (panelOk && evidenceItems.length > 0) {
    const allPairs: Pair[] = [];
    for (const item of evidenceItems) for (const p of toPairs(item.ratings)) allPairs.push(p);
    evidenceValue = weightedKappa(allPairs, 6, 'linear'); // 6-level evidence ladder
  }
  const evidenceEnough = panelOk && evidenceItems.length >= MIN_ITEMS_FOR_CLAIM;

  // --- Composite agreement (continuous). ICC(2,1). ---
  let compositeValue: number | null = null;
  let bandResult: ReturnType<typeof bandAgreement> = null;
  if (panelOk && subjects.length >= MIN_SUBJECTS_FOR_ICC) {
    const orderedRaters = input.raters;
    const compositeMatrix = subjects.map((s) => orderedRaters.map((r) => s.composite[r]));
    const bandMatrix = subjects.map((s) => orderedRaters.map((r) => s.band[r]));
    const fullyCrossed = compositeMatrix.every((row) => row.every((v) => typeof v === 'number'));
    if (fullyCrossed) {
      compositeValue = icc21(compositeMatrix);
      bandResult = bandAgreement(bandMatrix);
    } else {
      notes.push('composite ICC skipped: ratings are not fully crossed');
    }
  }
  const subjectsEnough = panelOk && subjects.length >= MIN_ITEMS_FOR_CLAIM;

  // --- Reviewer-variance feedback (per item) ---
  const reviewerVarianceByItem: Record<string, number> = {};
  for (const item of answerItems) {
    reviewerVarianceByItem[item.itemId] = pairVariance(
      Object.values(item.ratings),
      Math.max(1, item.categories - 1),
    );
  }
  for (const item of evidenceItems) {
    const v = pairVariance(Object.values(item.ratings), 5); // 6-level ladder span
    reviewerVarianceByItem[item.itemId] = Math.max(
      reviewerVarianceByItem[item.itemId] ?? 0,
      v,
    );
  }
  const recommendedReviewerVariance = Object.values(reviewerVarianceByItem).reduce(
    (max, v) => Math.max(max, v),
    0,
  );

  const answerAgreement: MetricResult = Object.freeze({
    value: answerValue,
    strength: interpretAgreement(answerValue),
    threshold: THRESHOLDS.answerKappa,
    verdict: verdictFor(answerValue, THRESHOLDS.answerKappa, answerEnough),
  });
  const evidenceAgreement: MetricResult = Object.freeze({
    value: evidenceValue,
    strength: interpretAgreement(evidenceValue),
    threshold: THRESHOLDS.evidenceWeightedKappa,
    verdict: verdictFor(evidenceValue, THRESHOLDS.evidenceWeightedKappa, evidenceEnough),
  });
  const compositeAgreement: MetricResult = Object.freeze({
    value: compositeValue,
    threshold: THRESHOLDS.compositeIcc,
    verdict: verdictFor(compositeValue, THRESHOLDS.compositeIcc, subjectsEnough),
  });
  const bandExactAgreement: MetricResult = Object.freeze({
    value: bandResult ? bandResult.exact : null,
    threshold: THRESHOLDS.bandExact,
    verdict: verdictFor(bandResult ? bandResult.exact : null, THRESHOLDS.bandExact, subjectsEnough),
  });
  const bandWithinOneAgreement: MetricResult = Object.freeze({
    value: bandResult ? bandResult.withinOne : null,
    threshold: THRESHOLDS.bandWithinOne,
    verdict: verdictFor(
      bandResult ? bandResult.withinOne : null,
      THRESHOLDS.bandWithinOne,
      subjectsEnough,
    ),
  });

  const applicable = [
    answerAgreement,
    evidenceAgreement,
    compositeAgreement,
    bandExactAgreement,
    bandWithinOneAgreement,
  ].filter((m) => m.value != null);
  const meetsProcurementFloor =
    applicable.length > 0 && applicable.every((m) => m.verdict === 'meets');

  if (!meetsProcurementFloor) {
    notes.push('procurement reliability floor NOT yet met (or insufficient data) — honest hold');
  }

  return Object.freeze({
    studyVersion: RELIABILITY_STUDY_VERSION,
    raterCount,
    answerAgreement,
    evidenceAgreement,
    compositeAgreement,
    bandExactAgreement,
    bandWithinOneAgreement,
    reviewerVarianceByItem: Object.freeze(reviewerVarianceByItem),
    recommendedReviewerVariance: Number(recommendedReviewerVariance.toFixed(4)),
    meetsProcurementFloor,
    notes: Object.freeze(notes),
  });
}
