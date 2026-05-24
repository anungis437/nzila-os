import { describe, expect, it } from 'vitest';
import { buildConfidenceEnvelope } from './confidence-model';
import { CONFIDENCE_STATES } from './confidenceContracts';

describe('Universal Confidence Model', () => {
  it('returns INSUFFICIENT when no inputs at all', () => {
    const env = buildConfidenceEnvelope(0.5, {});
    expect(env.confidence).toBe('INSUFFICIENT');
    expect(env.sampleSize).toBe(0);
    expect(env.cautionStates).toContain('SMALL_SAMPLE');
  });

  it('returns HIGH when sample, completeness, stability, age all favourable', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 20,
      dataCompleteness: 0.95,
      stability: 'STABLE',
      assessmentAgeDays: 30,
      governanceEvidencePresent: true,
      reviewerVariance: 0.05,
    });
    expect(env.confidence).toBe('HIGH');
    expect(env.cautionStates).toEqual([]);
    expect(env.decay).toBe('NONE');
  });

  it('drops HIGH to MODERATE under MILD decay', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 20,
      dataCompleteness: 0.95,
      stability: 'STABLE',
      assessmentAgeDays: 120,
    });
    expect(env.decay).toBe('MILD');
    expect(env.confidence).toBe('MODERATE');
  });

  it('collapses to INSUFFICIENT under SEVERE decay', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 50,
      dataCompleteness: 1,
      stability: 'STABLE',
      assessmentAgeDays: 400,
    });
    expect(env.decay).toBe('SEVERE');
    expect(env.confidence).toBe('INSUFFICIENT');
    expect(env.cautionStates).toContain('OUTDATED_ASSESSMENT');
  });

  it('emits TRANSITIONAL_INSTABILITY for transitional stability', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 20,
      dataCompleteness: 0.95,
      stability: 'TRANSITIONAL',
      assessmentAgeDays: 10,
    });
    expect(env.cautionStates).toContain('TRANSITIONAL_INSTABILITY');
    expect(env.confidence === 'MODERATE' || env.confidence === 'LOW').toBe(true);
  });

  it('lowers confidence on HIGH_VARIANCE', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 20,
      dataCompleteness: 0.95,
      stability: 'STABLE',
      assessmentAgeDays: 10,
      reviewerVariance: 0.5,
    });
    expect(env.cautionStates).toContain('HIGH_VARIANCE');
    expect(env.confidence === 'LOW' || env.confidence === 'INSUFFICIENT').toBe(true);
  });

  it('lowers confidence when governanceEvidencePresent=false', () => {
    const env = buildConfidenceEnvelope(0.42, {
      sampleSize: 20,
      dataCompleteness: 0.95,
      stability: 'STABLE',
      assessmentAgeDays: 10,
      governanceEvidencePresent: false,
    });
    expect(env.cautionStates).toContain('LIMITED_GOVERNANCE_EVIDENCE');
  });

  it('confidence is always one of the canonical states', () => {
    for (const sample of [0, 1, 5, 9, 10, 50]) {
      const env = buildConfidenceEnvelope(0, { sampleSize: sample });
      expect(CONFIDENCE_STATES).toContain(env.confidence);
    }
  });

  it('envelope is frozen', () => {
    const env = buildConfidenceEnvelope(0.5, { sampleSize: 10, dataCompleteness: 0.9 });
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.cautionStates)).toBe(true);
  });
});
