/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Assessor Certification & Governance
 * MODULE: OCI/OCRA "who may conduct an assessment" standard (Gap 2)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md
 *           docs/oci/superseded/government-readiness/OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md (§3.2 thresholds)
 *
 * The IRR harness measures whether two reviewers AGREE. This module answers the
 * prior regulator question: **who is allowed to conduct OCI/OCRA in the first
 * place, and how does that authorization stay current?** It converts
 * "reviewer-led" into "GOVERNED reviewer-led" — a five-level assessor standard
 * with calibration gates, certification validity, a recertification cadence,
 * minimum-sample-review obligations, and explicit suspension conditions.
 *
 * SAFETY CONSTITUTION (non-negotiable):
 *   - Reference/governance data only. NEVER imports the scoring engine; it cannot
 *     influence a dimension, composite, or maturity band.
 *   - Assessors are OPAQUE ids, never named persons in any output (anti-surveillance,
 *     consistent with the IRR "opaque rater id" rule).
 *   - Calibration is measured against a versioned reference set using the SAME
 *     thresholds the IRR doctrine proposes; the bar cannot be lowered silently.
 *   - Authorization is suspend-by-default on any failed condition; standing is
 *     EARNED and must be actively maintained, never assumed.
 *   - Pure & deterministic: same inputs → same standing. Dates are caller-supplied.
 */

import { THRESHOLDS } from '../reliability/reliabilityStudy';

export const ASSESSOR_GOVERNANCE_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// 1. The five-level assessor standard
// ─────────────────────────────────────────────────────────────────────────────

/** Assessor competency levels, weakest → strongest authority. */
export type AssessorLevel = 1 | 2 | 3 | 4 | 5;

export interface AssessorLevelSpec {
  readonly level: AssessorLevel;
  readonly title: string;
  /** Plain-language gate that must be met to hold this level. */
  readonly gate: string;
  /** May score a live assessment at all (under supervision counts). */
  readonly mayScoreLive: boolean;
  /** May score a live assessment WITHOUT supervision. */
  readonly mayScoreIndependently: boolean;
  /** May review and sign off another assessor's work. */
  readonly maySuperviseReviews: boolean;
  /** May certify or recertify other assessors. */
  readonly mayCertifyOthers: boolean;
  /** May own/version the calibration reference set. */
  readonly mayOwnCalibrationSet: boolean;
}

/** The canonical level definitions. Privileges are strictly monotonic by level. */
export const ASSESSOR_LEVELS: Readonly<Record<AssessorLevel, AssessorLevelSpec>> = Object.freeze({
  1: {
    level: 1,
    title: 'Trained',
    gate: 'Training complete',
    mayScoreLive: false,
    mayScoreIndependently: false,
    maySuperviseReviews: false,
    mayCertifyOthers: false,
    mayOwnCalibrationSet: false,
  },
  2: {
    level: 2,
    title: 'Calibrated',
    gate: 'Calibration complete (meets agreement thresholds against the reference set)',
    mayScoreLive: true,
    mayScoreIndependently: false,
    maySuperviseReviews: false,
    mayCertifyOthers: false,
    mayOwnCalibrationSet: false,
  },
  3: {
    level: 3,
    title: 'Certified assessor',
    gate: 'Certified: calibrated + supervised live reviews signed off',
    mayScoreLive: true,
    mayScoreIndependently: true,
    maySuperviseReviews: false,
    mayCertifyOthers: false,
    mayOwnCalibrationSet: false,
  },
  4: {
    level: 4,
    title: 'Senior reviewer',
    gate: 'Certified + track record; may supervise and sign off others',
    mayScoreLive: true,
    mayScoreIndependently: true,
    maySuperviseReviews: true,
    mayCertifyOthers: true,
    mayOwnCalibrationSet: false,
  },
  5: {
    level: 5,
    title: 'Calibration authority',
    gate: 'Senior reviewer entrusted to own the calibration set and certify others',
    mayScoreLive: true,
    mayScoreIndependently: true,
    maySuperviseReviews: true,
    mayCertifyOthers: true,
    mayOwnCalibrationSet: true,
  },
});

/** The minimum level permitted to conduct a live assessment independently. */
export const MIN_LEVEL_FOR_INDEPENDENT_ASSESSMENT: AssessorLevel = 3;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Calibration gate (reuses the IRR procurement thresholds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An assessor's measured agreement against the versioned calibration reference
 * set. Each field is `null` when that facet was not measured (honest absence).
 */
export interface CalibrationResult {
  readonly calibrationSetVersion: string;
  readonly answerKappa: number | null;
  readonly evidenceWeightedKappa: number | null;
  readonly compositeIcc: number | null;
  readonly bandExactAgreement: number | null;
}

/**
 * Calibration thresholds an assessor must meet to be certified. These ARE the
 * IRR procurement thresholds — an assessor must individually reach the agreement
 * bar the program promises collectively. Re-exported so the two never drift.
 */
export const CALIBRATION_THRESHOLDS = Object.freeze({
  answerKappa: THRESHOLDS.answerKappa,
  evidenceWeightedKappa: THRESHOLDS.evidenceWeightedKappa,
  compositeIcc: THRESHOLDS.compositeIcc,
  bandExact: THRESHOLDS.bandExact,
});

export interface CalibrationGateResult {
  readonly passed: boolean;
  /** Every facet that fell short or could not be measured. */
  readonly shortfalls: readonly string[];
}

/**
 * Evaluate whether a calibration result clears every threshold. A `null` facet
 * is a shortfall, not a pass — you cannot certify on unmeasured agreement.
 */
export function evaluateCalibration(result: CalibrationResult): CalibrationGateResult {
  const shortfalls: string[] = [];
  const check = (label: string, value: number | null, floor: number): void => {
    if (value === null) {
      shortfalls.push(`${label} was not measured (required ≥ ${floor}).`);
    } else if (value < floor) {
      shortfalls.push(`${label} ${value} is below the required ${floor}.`);
    }
  };
  check('answerKappa', result.answerKappa, CALIBRATION_THRESHOLDS.answerKappa);
  check(
    'evidenceWeightedKappa',
    result.evidenceWeightedKappa,
    CALIBRATION_THRESHOLDS.evidenceWeightedKappa,
  );
  check('compositeIcc', result.compositeIcc, CALIBRATION_THRESHOLDS.compositeIcc);
  check('bandExactAgreement', result.bandExactAgreement, CALIBRATION_THRESHOLDS.bandExact);
  return Object.freeze({ passed: shortfalls.length === 0, shortfalls: Object.freeze(shortfalls) });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Certification record, validity & cadence
// ─────────────────────────────────────────────────────────────────────────────

/** Annual recertification cadence (doctrine: certification is not permanent). */
export const RECERTIFICATION_CADENCE_DAYS = 365;

/**
 * Minimum number of double-scored (sampled) reviews an active assessor must
 * complete per certification period to keep their certification live. Below this,
 * there is too little signal to trust continued agreement.
 */
export const MIN_SAMPLE_REVIEWS_PER_PERIOD = 4;

export type CertificationStatus = 'active' | 'expired' | 'suspended' | 'revoked';

export interface CertificationRecord {
  /** Opaque assessor id — never a person's name. */
  readonly assessorId: string;
  readonly level: AssessorLevel;
  /** ISO-8601 date (YYYY-MM-DD) certification was granted/last renewed. */
  readonly certifiedOn: string;
  /** ISO-8601 date certification lapses absent recertification. */
  readonly validUntil: string;
  /** Calibration set version the assessor was last certified against. */
  readonly calibrationSetVersion: string;
  readonly status: CertificationStatus;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(label: string, value: string): void {
  if (!ISO_DATE.test(value)) {
    throw new AssessorGovernanceError(`${label} must be an ISO-8601 date (YYYY-MM-DD); got "${value}".`);
  }
}

export class AssessorGovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessorGovernanceError';
  }
}

/** Add `days` to an ISO date, returning a new ISO date. Pure, UTC-based. */
export function addDays(isoDate: string, days: number): string {
  assertIsoDate('isoDate', isoDate);
  const ms = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Build a certification record. Throws unless the calibration gate is cleared and
 * the level is one that may actually score (Level ≥ 2). Level 1 is "trained, not
 * yet certified" and is represented by the absence of a record, not a record.
 */
export function certifyAssessor(input: {
  readonly assessorId: string;
  readonly level: AssessorLevel;
  readonly certifiedOn: string;
  readonly calibration: CalibrationResult;
}): CertificationRecord {
  assertIsoDate('certifiedOn', input.certifiedOn);
  if (input.level < 2) {
    throw new AssessorGovernanceError(
      'Certification requires Level ≥ 2 (calibrated). Level 1 is trained-only and holds no certificate.',
    );
  }
  const gate = evaluateCalibration(input.calibration);
  if (!gate.passed) {
    throw new AssessorGovernanceError(
      `Cannot certify: calibration shortfalls — ${gate.shortfalls.join(' ')}`,
    );
  }
  return Object.freeze({
    assessorId: input.assessorId,
    level: input.level,
    certifiedOn: input.certifiedOn,
    validUntil: addDays(input.certifiedOn, RECERTIFICATION_CADENCE_DAYS),
    calibrationSetVersion: input.calibration.calibrationSetVersion,
    status: 'active' as CertificationStatus,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Standing evaluation & suspension conditions
// ─────────────────────────────────────────────────────────────────────────────

export type StandingVerdict = 'in_good_standing' | 'recertification_due' | 'suspended';

export interface StandingInput {
  readonly record: CertificationRecord;
  /** Evaluation date, ISO-8601. */
  readonly asOf: string;
  /** Latest sampled-calibration result, if any has been taken this period. */
  readonly latestCalibration?: CalibrationResult | null;
  /** Double-scored reviews completed in the current period. */
  readonly sampleReviewsThisPeriod?: number;
  /**
   * Current calibration-set version. If it has advanced past the version the
   * assessor was certified against, recertification is due (a material change to
   * the standard invalidates prior calibration — doctrine §4.3 recertification).
   */
  readonly currentCalibrationSetVersion?: string;
}

export interface Standing {
  readonly assessorId: string;
  readonly level: AssessorLevel;
  readonly verdict: StandingVerdict;
  /** Every reason contributing to the verdict (no short-circuit). */
  readonly reasons: readonly string[];
  /** True only when the assessor may independently conduct a live assessment now. */
  readonly mayConductLiveAssessment: boolean;
}

/**
 * Evaluate an assessor's current standing. Suspension dominates: any hard failure
 * (revoked, suspended, expired, calibration drift, insufficient sampling) yields
 * `suspended` and revokes live-assessment authority. A material calibration-set
 * change with no other failure yields `recertification_due` (authorization holds
 * until the validity date, but renewal is required).
 *
 * Deterministic and side-effect-free; reports ALL reasons.
 */
export function evaluateStanding(input: StandingInput): Standing {
  assertIsoDate('asOf', input.asOf);
  const { record } = input;
  const reasons: string[] = [];
  let suspended = false;
  let recertDue = false;

  if (record.status === 'revoked') {
    suspended = true;
    reasons.push('Certification has been revoked.');
  }
  if (record.status === 'suspended') {
    suspended = true;
    reasons.push('Certification is currently suspended.');
  }

  if (input.asOf > record.validUntil) {
    suspended = true;
    reasons.push(`Certification expired on ${record.validUntil}.`);
  } else {
    // Within validity: warn when inside the renewal window (last 10% of period).
    const renewalWindowStart = addDays(record.validUntil, -Math.round(RECERTIFICATION_CADENCE_DAYS * 0.1));
    if (input.asOf >= renewalWindowStart) {
      recertDue = true;
      reasons.push(`Certification renewal window open (valid until ${record.validUntil}).`);
    }
  }

  if (input.latestCalibration) {
    const gate = evaluateCalibration(input.latestCalibration);
    if (!gate.passed) {
      suspended = true;
      reasons.push(`Calibration drift below threshold — ${gate.shortfalls.join(' ')}`);
    }
  }

  if (
    typeof input.sampleReviewsThisPeriod === 'number' &&
    input.sampleReviewsThisPeriod < MIN_SAMPLE_REVIEWS_PER_PERIOD
  ) {
    suspended = true;
    reasons.push(
      `Only ${input.sampleReviewsThisPeriod} sampled reviews this period; ` +
        `${MIN_SAMPLE_REVIEWS_PER_PERIOD} required to maintain certification.`,
    );
  }

  if (
    input.currentCalibrationSetVersion !== undefined &&
    input.currentCalibrationSetVersion !== record.calibrationSetVersion
  ) {
    recertDue = true;
    reasons.push(
      `Calibration set advanced to ${input.currentCalibrationSetVersion}; ` +
        `assessor was certified against ${record.calibrationSetVersion}. Recertification required.`,
    );
  }

  const verdict: StandingVerdict = suspended
    ? 'suspended'
    : recertDue
      ? 'recertification_due'
      : 'in_good_standing';

  if (reasons.length === 0) {
    reasons.push('Active, calibrated, and within the certification period.');
  }

  const mayConductLiveAssessment =
    !suspended && record.level >= MIN_LEVEL_FOR_INDEPENDENT_ASSESSMENT;

  return Object.freeze({
    assessorId: record.assessorId,
    level: record.level,
    verdict,
    reasons: Object.freeze(reasons),
    mayConductLiveAssessment,
  });
}

/**
 * Convenience guard: may this assessor independently conduct a live assessment
 * right now? True only for an in-good-standing certificate at Level ≥ 3.
 */
export function mayConductAssessment(input: StandingInput): boolean {
  return evaluateStanding(input).mayConductLiveAssessment;
}
