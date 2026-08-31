/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (Gap 2)
 * MODULE: Assessor Certification & Governance
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md
 *
 * Proves "who may conduct OCI/OCRA" is GOVERNED:
 *   - five levels with strictly monotonic privileges;
 *   - certification requires clearing the IRR calibration thresholds;
 *   - certification is time-bound (annual recertification cadence);
 *   - suspension dominates: drift, under-sampling, expiry, or revocation all
 *     revoke live-assessment authority;
 *   - a material calibration-set change forces recertification;
 *   - assessors are opaque ids; the module imports no scoring engine.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  addDays,
  ASSESSOR_LEVELS,
  AssessorGovernanceError,
  CALIBRATION_THRESHOLDS,
  certifyAssessor,
  evaluateCalibration,
  evaluateStanding,
  mayConductAssessment,
  MIN_LEVEL_FOR_INDEPENDENT_ASSESSMENT,
  MIN_SAMPLE_REVIEWS_PER_PERIOD,
  RECERTIFICATION_CADENCE_DAYS,
  type AssessorLevel,
  type CalibrationResult,
  type CertificationRecord,
} from '../../assessors/assessorGovernance';
import { THRESHOLDS } from '../../reliability/reliabilityStudy';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOV_FILE = resolve(HERE, '../../assessors/assessorGovernance.ts');

function passingCalibration(overrides: Partial<CalibrationResult> = {}): CalibrationResult {
  return {
    calibrationSetVersion: '1.0.0',
    answerKappa: 0.7,
    evidenceWeightedKappa: 0.7,
    compositeIcc: 0.85,
    bandExactAgreement: 0.75,
    ...overrides,
  };
}

function activeRecord(overrides: Partial<CertificationRecord> = {}): CertificationRecord {
  return {
    assessorId: 'assessor-001',
    level: 3,
    certifiedOn: '2026-01-01',
    validUntil: addDays('2026-01-01', RECERTIFICATION_CADENCE_DAYS),
    calibrationSetVersion: '1.0.0',
    status: 'active',
    ...overrides,
  };
}

describe('Gap 2 — assessor level standard', () => {
  it('defines five levels with strictly monotonic privileges', () => {
    const levels: AssessorLevel[] = [1, 2, 3, 4, 5];
    for (const lvl of levels) {
      expect(ASSESSOR_LEVELS[lvl].level).toBe(lvl);
    }
    // Independent scoring begins at Level 3; supervision at 4; calibration authority at 5.
    expect(ASSESSOR_LEVELS[1].mayScoreLive).toBe(false);
    expect(ASSESSOR_LEVELS[2].mayScoreLive).toBe(true);
    expect(ASSESSOR_LEVELS[2].mayScoreIndependently).toBe(false);
    expect(ASSESSOR_LEVELS[3].mayScoreIndependently).toBe(true);
    expect(ASSESSOR_LEVELS[3].maySuperviseReviews).toBe(false);
    expect(ASSESSOR_LEVELS[4].maySuperviseReviews).toBe(true);
    expect(ASSESSOR_LEVELS[4].mayOwnCalibrationSet).toBe(false);
    expect(ASSESSOR_LEVELS[5].mayOwnCalibrationSet).toBe(true);
    expect(MIN_LEVEL_FOR_INDEPENDENT_ASSESSMENT).toBe(3);
  });
});

describe('Gap 2 — calibration gate', () => {
  it('reuses the IRR procurement thresholds (no drift)', () => {
    expect(CALIBRATION_THRESHOLDS.answerKappa).toBe(THRESHOLDS.answerKappa);
    expect(CALIBRATION_THRESHOLDS.compositeIcc).toBe(THRESHOLDS.compositeIcc);
    expect(CALIBRATION_THRESHOLDS.bandExact).toBe(THRESHOLDS.bandExact);
    expect(CALIBRATION_THRESHOLDS.evidenceWeightedKappa).toBe(THRESHOLDS.evidenceWeightedKappa);
  });

  it('passes a fully-measured result that clears every threshold', () => {
    expect(evaluateCalibration(passingCalibration()).passed).toBe(true);
  });

  it('treats an unmeasured facet as a shortfall, not a pass', () => {
    const gate = evaluateCalibration(passingCalibration({ compositeIcc: null }));
    expect(gate.passed).toBe(false);
    expect(gate.shortfalls.some((s) => /compositeIcc was not measured/.test(s))).toBe(true);
  });

  it('fails when a facet is below threshold', () => {
    const gate = evaluateCalibration(passingCalibration({ answerKappa: 0.4 }));
    expect(gate.passed).toBe(false);
  });
});

describe('Gap 2 — certification', () => {
  it('certifies an assessor that clears calibration and sets a one-year validity', () => {
    const record = certifyAssessor({
      assessorId: 'assessor-7',
      level: 3,
      certifiedOn: '2026-01-01',
      calibration: passingCalibration(),
    });
    expect(record.status).toBe('active');
    expect(record.validUntil).toBe(addDays('2026-01-01', RECERTIFICATION_CADENCE_DAYS));
  });

  it('refuses to certify below Level 2 (trained-only holds no certificate)', () => {
    expect(() =>
      certifyAssessor({ assessorId: 'a', level: 1, certifiedOn: '2026-01-01', calibration: passingCalibration() }),
    ).toThrow(AssessorGovernanceError);
  });

  it('refuses to certify when calibration falls short', () => {
    expect(() =>
      certifyAssessor({
        assessorId: 'a',
        level: 2,
        certifiedOn: '2026-01-01',
        calibration: passingCalibration({ bandExactAgreement: 0.1 }),
      }),
    ).toThrow(AssessorGovernanceError);
  });

  it('validates ISO date input', () => {
    expect(() =>
      certifyAssessor({ assessorId: 'a', level: 3, certifiedOn: '01/01/2026', calibration: passingCalibration() }),
    ).toThrow(AssessorGovernanceError);
  });
});

describe('Gap 2 — standing & suspension conditions', () => {
  it('reports good standing for an active, in-window, well-sampled assessor', () => {
    const standing = evaluateStanding({
      record: activeRecord(),
      asOf: '2026-06-01',
      sampleReviewsThisPeriod: MIN_SAMPLE_REVIEWS_PER_PERIOD,
      currentCalibrationSetVersion: '1.0.0',
    });
    expect(standing.verdict).toBe('in_good_standing');
    expect(standing.mayConductLiveAssessment).toBe(true);
  });

  it('suspends an expired certificate and revokes live authority', () => {
    const standing = evaluateStanding({ record: activeRecord(), asOf: '2027-06-01' });
    expect(standing.verdict).toBe('suspended');
    expect(standing.mayConductLiveAssessment).toBe(false);
    expect(standing.reasons.some((r) => /expired/.test(r))).toBe(true);
  });

  it('suspends on calibration drift below threshold', () => {
    const standing = evaluateStanding({
      record: activeRecord(),
      asOf: '2026-06-01',
      latestCalibration: passingCalibration({ answerKappa: 0.3 }),
    });
    expect(standing.verdict).toBe('suspended');
    expect(standing.reasons.some((r) => /drift/.test(r))).toBe(true);
  });

  it('suspends on insufficient sampled reviews', () => {
    const standing = evaluateStanding({
      record: activeRecord(),
      asOf: '2026-06-01',
      sampleReviewsThisPeriod: MIN_SAMPLE_REVIEWS_PER_PERIOD - 1,
    });
    expect(standing.verdict).toBe('suspended');
  });

  it('flags recertification when the calibration set advances', () => {
    const standing = evaluateStanding({
      record: activeRecord(),
      asOf: '2026-06-01',
      sampleReviewsThisPeriod: MIN_SAMPLE_REVIEWS_PER_PERIOD,
      currentCalibrationSetVersion: '2.0.0',
    });
    expect(standing.verdict).toBe('recertification_due');
    // Still authorized until the validity date — recert due, not suspended.
    expect(standing.mayConductLiveAssessment).toBe(true);
  });

  it('a Level-2 (supervised) assessor may not conduct independently even in good standing', () => {
    expect(
      mayConductAssessment({
        record: activeRecord({ level: 2 }),
        asOf: '2026-06-01',
        sampleReviewsThisPeriod: MIN_SAMPLE_REVIEWS_PER_PERIOD,
      }),
    ).toBe(false);
  });

  it('reports all reasons without short-circuiting and stays deterministic', () => {
    const input = {
      record: activeRecord({ status: 'active' as const }),
      asOf: '2027-06-01',
      sampleReviewsThisPeriod: 0,
      latestCalibration: passingCalibration({ compositeIcc: 0.1 }),
    };
    const a = evaluateStanding(input);
    const b = evaluateStanding(input);
    expect(a).toStrictEqual(b);
    expect(a.reasons.length).toBeGreaterThanOrEqual(3);
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});

describe('Gap 2 — isolation', () => {
  it('does not import the scoring engine', () => {
    const src = readFileSync(GOV_FILE, 'utf8');
    expect(src).not.toMatch(/from ['"].*\/scoring['"]/);
    expect(src).not.toMatch(/scoreAssessment|computeProfile/);
  });
});
