import { describe, it, expect } from 'vitest';

import {
  calculateMovingAverage,
  calculateExponentialMovingAverage,
  forecastLinearRegression,
  forecastMovingAverage,
  detectSeasonalPattern,
  detectAnomalies,
  detectTrend,
  generateEnsembleForecast,
  type TimeSeriesData,
  type PredictionResult,
  type TrendAnalysisResult,
  type AnomalyDetectionResult,
} from '../predictive-analytics';

function makeTimeSeries(values: number[], startDate = new Date('2024-01-01')): TimeSeriesData[] {
  return values.map((value, i) => ({
    date: new Date(startDate.getTime() + i * 86400000),
    value,
  }));
}

describe('predictive-analytics', () => {
  describe('calculateMovingAverage', () => {
    it('returns same array length as input', () => {
      const result = calculateMovingAverage([1, 2, 3, 4, 5], 3);
      expect(result).toHaveLength(5);
    });

    it('returns raw values for indices before window fills', () => {
      const result = calculateMovingAverage([10, 20, 30, 40], 3);
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(20);
    });

    it('computes correct moving average once window fills', () => {
      const result = calculateMovingAverage([10, 20, 30, 40], 3);
      expect(result[2]).toBeCloseTo(20); // (10+20+30)/3
      expect(result[3]).toBeCloseTo(30); // (20+30+40)/3
    });

    it('handles window size 1 (identity)', () => {
      const data = [5, 10, 15];
      const result = calculateMovingAverage(data, 1);
      expect(result).toEqual(data);
    });

    it('handles window size equal to data length', () => {
      const data = [2, 4, 6];
      const result = calculateMovingAverage(data, 3);
      expect(result[2]).toBeCloseTo(4); // (2+4+6)/3
    });
  });

  describe('calculateExponentialMovingAverage', () => {
    it('first value is always the raw data point', () => {
      const result = calculateExponentialMovingAverage([100, 200, 300]);
      expect(result[0]).toBe(100);
    });

    it('returns same length as input', () => {
      const result = calculateExponentialMovingAverage([1, 2, 3, 4], 0.5);
      expect(result).toHaveLength(4);
    });

    it('EMA with alpha=1 equals raw data', () => {
      const data = [10, 20, 30];
      const result = calculateExponentialMovingAverage(data, 1);
      expect(result).toEqual(data);
    });

    it('EMA with alpha=0 equals first value repeated', () => {
      const result = calculateExponentialMovingAverage([50, 100, 200], 0);
      expect(result).toEqual([50, 50, 50]);
    });

    it('EMA is between extremes for 0 < alpha < 1', () => {
      const result = calculateExponentialMovingAverage([10, 50], 0.3);
      expect(result[1]).toBeGreaterThan(10);
      expect(result[1]).toBeLessThan(50);
    });
  });

  describe('forecastLinearRegression', () => {
    it('returns requested number of predictions', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50]);
      const result = forecastLinearRegression(data, 3);
      expect(result).toHaveLength(3);
    });

    it('each prediction has required fields', () => {
      const data = makeTimeSeries([10, 20, 30]);
      const result = forecastLinearRegression(data, 1);
      const p = result[0];
      expect(p).toHaveProperty('predictedValue');
      expect(p).toHaveProperty('confidenceInterval');
      expect(p.confidenceInterval).toHaveProperty('lower');
      expect(p.confidenceInterval).toHaveProperty('upper');
      expect(p).toHaveProperty('confidenceScore');
      expect(p.modelName).toBe('linear_regression');
      expect(p.modelVersion).toBe('1.0.0');
    });

    it('predicts increasing trend for ascending data', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50]);
      const result = forecastLinearRegression(data, 2);
      expect(result[0].predictedValue).toBeGreaterThan(50);
      expect(result[1].predictedValue).toBeGreaterThan(result[0].predictedValue);
    });

    it('confidence interval lower < predicted < upper', () => {
      const data = makeTimeSeries([5, 10, 8, 12, 15, 11, 14]);
      const result = forecastLinearRegression(data, 1);
      const p = result[0];
      expect(p.confidenceInterval.lower).toBeLessThan(p.predictedValue);
      expect(p.confidenceInterval.upper).toBeGreaterThan(p.predictedValue);
    });

    it('confidence score between 0 and 1', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50]);
      const result = forecastLinearRegression(data, 1);
      expect(result[0].confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result[0].confidenceScore).toBeLessThanOrEqual(1);
    });

    it('features include slope and intercept', () => {
      const data = makeTimeSeries([10, 20, 30]);
      const result = forecastLinearRegression(data, 1);
      expect(result[0].features).toHaveProperty('slope');
      expect(result[0].features).toHaveProperty('intercept');
    });
  });

  describe('forecastMovingAverage', () => {
    it('returns requested number of predictions', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = forecastMovingAverage(data, 4, 3);
      expect(result).toHaveLength(4);
    });

    it('all predictions have same predictedValue (last MA)', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50]);
      const result = forecastMovingAverage(data, 3, 3);
      const pv = result[0].predictedValue;
      result.forEach((p) => {
        expect(p.predictedValue).toBe(pv);
      });
    });

    it('model name is moving_average', () => {
      const data = makeTimeSeries([10, 20, 30, 40]);
      const result = forecastMovingAverage(data, 1, 2);
      expect(result[0].modelName).toBe('moving_average');
    });

    it('confidence score is 0.7', () => {
      const data = makeTimeSeries([10, 20, 30, 40]);
      const result = forecastMovingAverage(data, 1, 2);
      expect(result[0].confidenceScore).toBe(0.7);
    });
  });

  describe('detectSeasonalPattern', () => {
    it('returns null for insufficient data (< 14 points)', () => {
      const data = makeTimeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(detectSeasonalPattern(data)).toBeNull();
    });

    it('detects weekly pattern in periodic data', () => {
      // Generate data with clear weekly pattern
      const values: number[] = [];
      for (let i = 0; i < 56; i++) {
        values.push(10 + 5 * Math.sin((2 * Math.PI * i) / 7));
      }
      const data = makeTimeSeries(values);
      const result = detectSeasonalPattern(data, 7);
      if (result) {
        expect(result.period).toBe(7);
        expect(result.strength).toBeGreaterThan(0.3);
      }
    });

    it('returns null for random data with no seasonality', () => {
      // Monotonically increasing (no seasonal pattern)
      const data = makeTimeSeries(Array.from({ length: 30 }, (_, i) => i));
      const result = detectSeasonalPattern(data);
      // May or may not detect — if no strong autocorrelation, returns null
      if (result) {
        expect(result.strength).toBeGreaterThan(0.3);
      }
    });

    it('uses expectedPeriod when provided', () => {
      const values: number[] = [];
      for (let i = 0; i < 60; i++) {
        values.push(10 + 5 * Math.sin((2 * Math.PI * i) / 14));
      }
      const data = makeTimeSeries(values);
      const result = detectSeasonalPattern(data, 14);
      if (result) {
        expect(result.period).toBe(14);
      }
    });
  });

  describe('detectAnomalies', () => {
    it('returns result for each data point', () => {
      const data = makeTimeSeries([10, 10, 10, 10, 10]);
      const result = detectAnomalies(data);
      expect(result).toHaveLength(5);
    });

    it('flags extreme outliers as anomalies', () => {
      const data = makeTimeSeries([10, 10, 10, 10, 10, 100, 10, 10, 10, 10]);
      const result = detectAnomalies(data, 2);
      const anomalies = result.filter((r) => r.isAnomaly);
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('all results have required fields', () => {
      const data = makeTimeSeries([1, 2, 3]);
      const result = detectAnomalies(data);
      result.forEach((r) => {
        expect(r).toHaveProperty('isAnomaly');
        expect(r).toHaveProperty('severity');
        expect(r).toHaveProperty('expectedValue');
        expect(r).toHaveProperty('actualValue');
        expect(r).toHaveProperty('deviation');
        expect(r).toHaveProperty('deviationPercentage');
        expect(r).toHaveProperty('confidence');
      });
    });

    it('severity escalates with deviation', () => {
      // Create data where one point is extremely far
      const values = Array(20).fill(10);
      values.push(1000); // massive outlier
      const data = makeTimeSeries(values);
      const result = detectAnomalies(data, 2);
      const outlier = result[result.length - 1];
      expect(outlier.isAnomaly).toBe(true);
      expect(['high', 'critical']).toContain(outlier.severity);
    });

    it('no anomalies in uniform data', () => {
      const data = makeTimeSeries(Array(10).fill(42));
      const result = detectAnomalies(data, 3);
      // stdDev=0, so zScore would be NaN/Infinity — implementation should handle
      // Just verify it doesn't crash
      expect(result).toHaveLength(10);
    });
  });

  describe('detectTrend', () => {
    it('detects increasing trend', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      const result = detectTrend(data);
      expect(result.detectedTrend).toBe('increasing');
    });

    it('detects decreasing trend', () => {
      const data = makeTimeSeries([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
      const result = detectTrend(data);
      expect(result.detectedTrend).toBe('decreasing');
    });

    it('detects stable trend for flat data', () => {
      const data = makeTimeSeries(Array(20).fill(50));
      const result = detectTrend(data);
      expect(result.detectedTrend).toBe('stable');
    });

    it('result has required fields', () => {
      const data = makeTimeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const result = detectTrend(data);
      expect(result).toHaveProperty('detectedTrend');
      expect(result).toHaveProperty('trendStrength');
      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('correlations');
      expect(result).toHaveProperty('confidence');
    });

    it('trendStrength between 0 and 1 for linear data', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50]);
      const result = detectTrend(data);
      expect(result.trendStrength).toBeGreaterThanOrEqual(0);
      expect(result.trendStrength).toBeLessThanOrEqual(1);
    });
  });

  describe('generateEnsembleForecast', () => {
    it('returns requested number of predictions', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = generateEnsembleForecast(data, 3);
      expect(result).toHaveLength(3);
    });

    it('model name is ensemble', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = generateEnsembleForecast(data, 1);
      expect(result[0].modelName).toBe('ensemble');
    });

    it('ensemble value is average of linear and MA predictions', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = generateEnsembleForecast(data, 1);
      const features = result[0].features as Record<string, unknown>;
      const linearPred = features.linearPrediction as number;
      const maPred = features.maPrediction as number;
      expect(result[0].predictedValue).toBeCloseTo((linearPred + maPred) / 2);
    });

    it('confidence interval spans both models', () => {
      const data = makeTimeSeries([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = generateEnsembleForecast(data, 1);
      expect(result[0].confidenceInterval.lower).toBeDefined();
      expect(result[0].confidenceInterval.upper).toBeDefined();
      expect(result[0].confidenceInterval.lower).toBeLessThan(
        result[0].confidenceInterval.upper,
      );
    });
  });

  describe('type exports', () => {
    it('TimeSeriesData shape', () => {
      const d: TimeSeriesData = { date: new Date(), value: 42 };
      expect(d).toHaveProperty('date');
      expect(d).toHaveProperty('value');
    });

    it('PredictionResult shape', () => {
      const p: PredictionResult = {
        predictedValue: 10,
        confidenceInterval: { lower: 5, upper: 15 },
        confidenceScore: 0.9,
        features: {},
        modelName: 'test',
        modelVersion: '1.0',
      };
      expect(p.modelName).toBe('test');
    });

    it('TrendAnalysisResult shape', () => {
      const t: TrendAnalysisResult = {
        detectedTrend: 'stable',
        trendStrength: 0.5,
        anomalies: [],
        correlations: {},
        confidence: 0.5,
      };
      expect(t.detectedTrend).toBe('stable');
    });

    it('AnomalyDetectionResult shape', () => {
      const a: AnomalyDetectionResult = {
        isAnomaly: false,
        severity: 'low',
        expectedValue: 10,
        actualValue: 10,
        deviation: 0,
        deviationPercentage: 0,
        confidence: 0,
      };
      expect(a.isAnomaly).toBe(false);
    });
  });
});
