/**
 * AI Bias Detection — Tests
 */

import { describe, it, expect } from 'vitest';
import { assessBias, buildBiasEvidenceArtifact, type BiasAssessmentInput } from '../bias-detection.js';

const FAIR_INPUT: BiasAssessmentInput = {
  modelId: 'loan-classifier-v2',
  modelVersion: '2.1.0',
  protectedAttribute: 'gender',
  referenceGroup: 'male',
  groups: [
    { groupName: 'male', attribute: 'gender', sampleCount: 1000, positiveCount: 600, negativeCount: 400 },
    { groupName: 'female', attribute: 'gender', sampleCount: 1000, positiveCount: 560, negativeCount: 440 },
  ],
};

const BIASED_INPUT: BiasAssessmentInput = {
  modelId: 'hiring-classifier-v1',
  protectedAttribute: 'ethnicity',
  referenceGroup: 'group_a',
  groups: [
    { groupName: 'group_a', attribute: 'ethnicity', sampleCount: 1000, positiveCount: 800, negativeCount: 200 },
    { groupName: 'group_b', attribute: 'ethnicity', sampleCount: 1000, positiveCount: 300, negativeCount: 700 },
  ],
};

const INPUT_WITH_GROUND_TRUTH: BiasAssessmentInput = {
  modelId: 'risk-scorer-v3',
  protectedAttribute: 'region',
  referenceGroup: 'urban',
  groups: [
    {
      groupName: 'urban', attribute: 'region', sampleCount: 500, positiveCount: 250, negativeCount: 250,
      truePositives: 200, falsePositives: 50, trueNegatives: 200, falseNegatives: 50,
    },
    {
      groupName: 'rural', attribute: 'region', sampleCount: 500, positiveCount: 200, negativeCount: 300,
      truePositives: 120, falsePositives: 80, trueNegatives: 220, falseNegatives: 80,
    },
  ],
};

describe('assessBias', () => {
  it('returns PASS for a fair model', () => {
    const result = assessBias(FAIR_INPUT);
    expect(result.overallVerdict).toBe('PASS');
    expect(result.modelId).toBe('loan-classifier-v2');
    expect(result.metrics.length).toBeGreaterThanOrEqual(2);
    expect(result.metrics.every(m => m.passes)).toBe(true);
  });

  it('returns FAIL for a biased model', () => {
    const result = assessBias(BIASED_INPUT);
    expect(result.overallVerdict).toBe('FAIL');
    expect(result.recommendations.length).toBeGreaterThan(0);

    const diMetric = result.metrics.find(m => m.metricName === 'Disparate Impact Ratio');
    expect(diMetric).toBeDefined();
    expect(diMetric!.passes).toBe(false);
    expect(diMetric!.value).toBeLessThan(0.8);
  });

  it('computes equalized odds when ground truth is available', () => {
    const result = assessBias(INPUT_WITH_GROUND_TRUTH);
    const eoMetric = result.metrics.find(m => m.metricName === 'Equalized Odds Difference');
    expect(eoMetric).toBeDefined();
    expect(typeof eoMetric!.value).toBe('number');
  });

  it('does not compute equalized odds without ground truth', () => {
    const result = assessBias(FAIR_INPUT);
    const eoMetric = result.metrics.find(m => m.metricName === 'Equalized Odds Difference');
    expect(eoMetric).toBeUndefined();
  });

  it('throws when reference group is missing', () => {
    expect(() =>
      assessBias({ ...FAIR_INPUT, referenceGroup: 'nonexistent' }),
    ).toThrow('Reference group "nonexistent" not found');
  });

  it('includes group selection rates in results', () => {
    const result = assessBias(FAIR_INPUT);
    expect(result.groupResults).toHaveLength(2);
    expect(result.groupResults[0]!.selectionRate).toBe(0.6);
  });

  it('handles zero reference selection rate', () => {
    const result = assessBias({
      modelId: 'zero-ref-test',
      protectedAttribute: 'test_attr',
      referenceGroup: 'ref',
      groups: [
        { groupName: 'ref', attribute: 'test_attr', sampleCount: 100, positiveCount: 0, negativeCount: 100 },
        { groupName: 'zero_comp', attribute: 'test_attr', sampleCount: 100, positiveCount: 0, negativeCount: 100 },
        { groupName: 'nonzero_comp', attribute: 'test_attr', sampleCount: 100, positiveCount: 50, negativeCount: 50 },
      ],
    });
    // ref SR=0, zero_comp SR=0 → diRatio=1; nonzero_comp SR>0 → diRatio=0
    const diMetric = result.metrics.find(m => m.metricName === 'Disparate Impact Ratio');
    expect(diMetric).toBeDefined();
    expect(diMetric!.value).toBe(0);
    expect(diMetric!.passes).toBe(false);
  });

  it('returns WARN when exactly one metric fails', () => {
    const result = assessBias({
      modelId: 'warn-test',
      protectedAttribute: 'region',
      referenceGroup: 'urban',
      groups: [
        {
          groupName: 'urban', attribute: 'region', sampleCount: 1000, positiveCount: 500, negativeCount: 500,
          truePositives: 400, falseNegatives: 100, falsePositives: 30, trueNegatives: 470,
        },
        {
          groupName: 'rural', attribute: 'region', sampleCount: 1000, positiveCount: 450, negativeCount: 550,
          truePositives: 195, falseNegatives: 255, falsePositives: 200, trueNegatives: 350,
        },
      ],
    });
    // DI = 0.9 ≥ 0.8 ✓, SP = 0.05 ≤ 0.1 ✓, EO TPR diff = 0.367 > 0.1 ✗
    expect(result.overallVerdict).toBe('WARN');
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('One fairness metric failed')]),
    );
  });

  it('uses FPR difference when it exceeds TPR difference for equalized odds', () => {
    const result = assessBias({
      modelId: 'fpr-test',
      protectedAttribute: 'region',
      referenceGroup: 'urban',
      groups: [
        {
          groupName: 'urban', attribute: 'region', sampleCount: 500, positiveCount: 250, negativeCount: 250,
          truePositives: 200, falseNegatives: 50, falsePositives: 30, trueNegatives: 220,
        },
        {
          groupName: 'rural', attribute: 'region', sampleCount: 500, positiveCount: 250, negativeCount: 250,
          truePositives: 195, falseNegatives: 55, falsePositives: 200, trueNegatives: 50,
        },
      ],
    });
    // TPR diff = |0.78 - 0.8| = 0.02, FPR diff = |0.8 - 0.12| = 0.68 → worst = 0.68
    const eoMetric = result.metrics.find(m => m.metricName === 'Equalized Odds Difference');
    expect(eoMetric).toBeDefined();
    expect(eoMetric!.value).toBeCloseTo(0.68, 2);
    expect(eoMetric!.passes).toBe(false);
  });

  it('handles zero sample count and zero ground truth totals', () => {
    const result = assessBias({
      modelId: 'zero-edge',
      protectedAttribute: 'test',
      referenceGroup: 'ref',
      groups: [
        {
          groupName: 'ref', attribute: 'test', sampleCount: 100, positiveCount: 50, negativeCount: 50,
          truePositives: 40, falseNegatives: 10, falsePositives: 5, trueNegatives: 45,
        },
        {
          groupName: 'empty', attribute: 'test', sampleCount: 0, positiveCount: 0, negativeCount: 0,
          truePositives: 0, falseNegatives: 0, falsePositives: 0, trueNegatives: 0,
        },
      ],
    });
    const emptyGroup = result.groupResults.find(g => g.groupName === 'empty');
    expect(emptyGroup!.selectionRate).toBe(0);
    expect(emptyGroup!.truePositiveRate).toBeNull();
    expect(emptyGroup!.falsePositiveRate).toBeNull();
  });

  it('passes equalized odds with similar groups and covers tprDiff not-updating branch', () => {
    const result = assessBias({
      modelId: 'eo-pass-test',
      protectedAttribute: 'segment',
      referenceGroup: 'ref',
      groups: [
        {
          groupName: 'ref', attribute: 'segment', sampleCount: 100, positiveCount: 50, negativeCount: 50,
          truePositives: 40, falseNegatives: 10, falsePositives: 5, trueNegatives: 45,
        },
        {
          groupName: 'near', attribute: 'segment', sampleCount: 100, positiveCount: 48, negativeCount: 52,
          truePositives: 38, falseNegatives: 12, falsePositives: 5, trueNegatives: 45,
        },
        {
          groupName: 'closer', attribute: 'segment', sampleCount: 100, positiveCount: 49, negativeCount: 51,
          truePositives: 39, falseNegatives: 11, falsePositives: 5, trueNegatives: 45,
        },
      ],
    });
    // near TPR=38/50=0.76, diff=0.04; closer TPR=39/50=0.78, diff=0.02 < 0.04 → not updated
    // EO worst=0.04 ≤ 0.1 → passes
    const eoMetric = result.metrics.find(m => m.metricName === 'Equalized Odds Difference');
    expect(eoMetric).toBeDefined();
    expect(eoMetric!.passes).toBe(true);
    expect(result.overallVerdict).toBe('PASS');
  });
});

describe('buildBiasEvidenceArtifact', () => {
  it('builds an evidence artifact from assessment result', () => {
    const result = assessBias(FAIR_INPUT);
    const artifact = buildBiasEvidenceArtifact(result);
    expect(artifact.type).toBe('ai_bias_assessment');
    expect(artifact.modelId).toBe('loan-classifier-v2');
    expect(artifact.verdict).toBe('PASS');
    expect(artifact.metrics.length).toBeGreaterThan(0);
  });
});
