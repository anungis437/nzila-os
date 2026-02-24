/**
 * Predictive Analytics Engine
 * Q1 2025 - Advanced Analytics
 * 
 * Provides machine learning capabilities for:
 * - Time series forecasting (claims volume, resource needs, budgets)
 * - Trend detection and analysis
 * - Anomaly detection
 * - Statistical analysis and correlations
 */

import { mean, standardDeviation, linearRegression } from 'simple-statistics';

// Types
export interface TimeSeriesData {
  date: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface PredictionResult {
  predictedValue: number;
  confidenceInterval: { lower: number; upper: number };
  confidenceScore: number;
  features: Record<string, unknown>;
  modelName: string;
  modelVersion: string;
}

export interface TrendAnalysisResult {
  detectedTrend: 'increasing' | 'decreasing' | 'seasonal' | 'cyclical' | 'stable';
  trendStrength: number; // 0-1
  anomalies: Array<{
    date: Date;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  seasonalPattern?: {
    period: number; // days
    strength: number; // 0-1
    peaks: number[];
    troughs: number[];
  };
  correlations: Record<string, number>;
  confidence: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expectedValue: number;
  actualValue: number;
  deviation: number;
  deviationPercentage: number;
  confidence: number;
}

/**
 * Simple Moving Average - Used for smoothing time series data
 */
export function calculateMovingAverage(
  data: number[],
  windowSize: number
): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      result.push(data[i]);
      continue;
    }
    
    const window = data.slice(i - windowSize + 1, i + 1);
    const avg = mean(window);
    result.push(avg);
  }
  
  return result;
}

/**
 * Exponential Moving Average - Gives more weight to recent observations
 */
export function calculateExponentialMovingAverage(
  data: number[],
  alpha: number = 0.3
): number[] {
  const result: number[] = [];
  let ema = data[0];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i]);
      continue;
    }
    
    ema = alpha * data[i] + (1 - alpha) * ema;
    result.push(ema);
  }
  
  return result;
}

/**
 * Linear Regression Forecast - Simple trend-based prediction
 */
export function forecastLinearRegression(
  historicalData: TimeSeriesData[],
  periodsAhead: number
): PredictionResult[] {
  // Convert dates to numeric values (days since first observation)
  const firstDate = historicalData[0].date.getTime();
  const dataPoints: [number, number][] = historicalData.map((d, _i) => [
    (d.date.getTime() - firstDate) / (1000 * 60 * 60 * 24), // Days
    d.value
  ]);
  
  // Calculate linear regression
  const regression = linearRegression(dataPoints);
  const lastDay = dataPoints[dataPoints.length - 1][0];
  
  // Calculate residual standard error for confidence intervals
  const residuals = dataPoints.map(([x, y]) => {
    const predicted = regression.m * x + regression.b;
    return y - predicted;
  });
  const residualStd = standardDeviation(residuals);
  
  // Generate predictions
  const predictions: PredictionResult[] = [];
  
  for (let i = 1; i <= periodsAhead; i++) {
    const targetDay = lastDay + i;
    const predictedValue = regression.m * targetDay + regression.b;
    
    // 95% confidence interval (±1.96 * std error)
    const marginOfError = 1.96 * residualStd * Math.sqrt(1 + 1/dataPoints.length);
    
    predictions.push({
      predictedValue,
      confidenceInterval: {
        lower: predictedValue - marginOfError,
        upper: predictedValue + marginOfError
      },
      confidenceScore: calculateConfidenceScore(dataPoints, regression),
      features: {
        slope: regression.m,
        intercept: regression.b,
        dataPoints: dataPoints.length,
        residualStd
      },
      modelName: 'linear_regression',
      modelVersion: '1.0.0'
    });
  }
  
  return predictions;
}

/**
 * Moving Average Forecast - Naive forecast using moving average
 */
export function forecastMovingAverage(
  historicalData: TimeSeriesData[],
  periodsAhead: number,
  windowSize: number = 7
): PredictionResult[] {
  const values = historicalData.map(d => d.value);
  const movingAvg = calculateMovingAverage(values, windowSize);
  
  // Use last moving average as forecast for all future periods
  const lastMA = movingAvg[movingAvg.length - 1];
  
  // Calculate standard deviation of recent values for confidence interval
  const recentValues = values.slice(-windowSize);
  const stdDev = standardDeviation(recentValues);
  
  const predictions: PredictionResult[] = [];
  
  for (let i = 0; i < periodsAhead; i++) {
    predictions.push({
      predictedValue: lastMA,
      confidenceInterval: {
        lower: lastMA - 1.96 * stdDev,
        upper: lastMA + 1.96 * stdDev
      },
      confidenceScore: 0.7, // Moving average has moderate confidence
      features: {
        windowSize,
        movingAverage: lastMA,
        standardDeviation: stdDev,
        dataPoints: values.length
      },
      modelName: 'moving_average',
      modelVersion: '1.0.0'
    });
  }
  
  return predictions;
}

/**
 * Seasonal Decomposition - Identifies seasonal patterns
 */
export function detectSeasonalPattern(
  data: TimeSeriesData[],
  expectedPeriod?: number
): { period: number; strength: number; peaks: number[]; troughs: number[] } | null {
  if (data.length < 14) return null; // Need at least 2 weeks of data
  
  const values = data.map(d => d.value);
  const testPeriods = expectedPeriod ? [expectedPeriod] : [7, 14, 30]; // Weekly, biweekly, monthly
  
  let bestPeriod = 7;
  let bestStrength = 0;
  
  for (const period of testPeriods) {
    if (values.length < period * 2) continue;
    
    // Calculate autocorrelation at lag = period
    const correlation = calculateAutocorrelation(values, period);
    
    if (Math.abs(correlation) > bestStrength) {
      bestStrength = Math.abs(correlation);
      bestPeriod = period;
    }
  }
  
  if (bestStrength < 0.3) return null; // No significant seasonality
  
  // Find peaks and troughs within the period
  const peaks: number[] = [];
  const troughs: number[] = [];
  
  for (let i = 1; i < bestPeriod - 1; i++) {
    const indices: number[] = [];
    for (let j = i; j < values.length; j += bestPeriod) {
      indices.push(j);
    }
    
    const avgValue = mean(indices.map(idx => values[idx]));
    const overallAvg = mean(values);
    
    if (avgValue > overallAvg * 1.1) peaks.push(i);
    if (avgValue < overallAvg * 0.9) troughs.push(i);
  }
  
  return {
    period: bestPeriod,
    strength: bestStrength,
    peaks,
    troughs
  };
}

/**
 * Anomaly Detection using Z-Score method
 */
export function detectAnomalies(
  data: TimeSeriesData[],
  threshold: number = 3.0 // Number of standard deviations
): AnomalyDetectionResult[] {
  const values = data.map(d => d.value);
  const avg = mean(values);
  const stdDev = standardDeviation(values);
  
  return data.map((point, _i) => {
    const zScore = Math.abs((point.value - avg) / stdDev);
    const isAnomaly = zScore > threshold;
    const deviationPercentage = ((point.value - avg) / avg) * 100;
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (zScore > 4) severity = 'critical';
    else if (zScore > 3.5) severity = 'high';
    else if (zScore > 3) severity = 'medium';
    
    return {
      isAnomaly,
      severity,
      expectedValue: avg,
      actualValue: point.value,
      deviation: point.value - avg,
      deviationPercentage,
      confidence: Math.min(zScore / 5, 1) // Normalize to 0-1
    };
  });
}

/**
 * Trend Detection using linear regression slope
 */
export function detectTrend(
  data: TimeSeriesData[]
): TrendAnalysisResult {
  const values = data.map(d => d.value);
  const dataPoints: [number, number][] = values.map((v, i) => [i, v]);
  
  // Calculate linear regression
  const regression = linearRegression(dataPoints);
  const slope = regression.m;
  const avgValue = mean(values);
  
  // Determine trend direction
  let detectedTrend: 'increasing' | 'decreasing' | 'seasonal' | 'cyclical' | 'stable';
  const slopePercentage = (slope / avgValue) * 100;
  
  if (Math.abs(slopePercentage) < 1) {
    detectedTrend = 'stable';
  } else if (slope > 0) {
    detectedTrend = 'increasing';
  } else {
    detectedTrend = 'decreasing';
  }
  
  // Check for seasonality
  const seasonalPattern = detectSeasonalPattern(data);
  if (seasonalPattern && seasonalPattern.strength > 0.5) {
    detectedTrend = 'seasonal';
  }
  
  // Calculate trend strength (R-squared)
  const predictions = dataPoints.map(([x]) => regression.m * x + regression.b);
  const rSquared = calculateRSquared(values, predictions);
  
  // Detect anomalies
  const anomalyResults = detectAnomalies(data, 2.5);
  const anomalies = data
    .map((point, i) => ({
      date: point.date,
      value: point.value,
      expectedValue: anomalyResults[i].expectedValue,
      deviation: anomalyResults[i].deviation,
      severity: anomalyResults[i].severity
    }))
    .filter((_, i) => anomalyResults[i].isAnomaly);
  
  return {
    detectedTrend,
    trendStrength: rSquared,
    anomalies,
    seasonalPattern: seasonalPattern || undefined,
    correlations: {}, // Would calculate correlations with other metrics
    confidence: rSquared
  };
}

/**
 * Calculate autocorrelation at a specific lag
 */
function calculateAutocorrelation(data: number[], lag: number): number {
  if (lag >= data.length) return 0;
  
  const n = data.length - lag;
  const meanVal = mean(data);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (data[i] - meanVal) * (data[i + lag] - meanVal);
  }
  
  for (let i = 0; i < data.length; i++) {
    denominator += Math.pow(data[i] - meanVal, 2);
  }
  
  return numerator / denominator;
}

/**
 * Calculate R-squared (coefficient of determination)
 */
function calculateRSquared(actual: number[], predicted: number[]): number {
  const meanActual = mean(actual);
  
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares
  
  for (let i = 0; i < actual.length; i++) {
    ssRes += Math.pow(actual[i] - predicted[i], 2);
    ssTot += Math.pow(actual[i] - meanActual, 2);
  }
  
  return 1 - (ssRes / ssTot);
}

/**
 * Calculate confidence score for linear regression
 */
function calculateConfidenceScore(
  dataPoints: [number, number][],
  regression: { m: number; b: number }
): number {
  const values = dataPoints.map(([_, y]) => y);
  const predictions = dataPoints.map(([x]) => regression.m * x + regression.b);
  
  const rSquared = calculateRSquared(values, predictions);
  
  // Adjust confidence based on sample size
  const sampleSizeAdjustment = Math.min(dataPoints.length / 30, 1);
  
  return rSquared * sampleSizeAdjustment;
}

/**
 * Generate forecasts using multiple models and return ensemble average
 */
export function generateEnsembleForecast(
  historicalData: TimeSeriesData[],
  periodsAhead: number
): PredictionResult[] {
  // Get predictions from multiple models
  const linearPredictions = forecastLinearRegression(historicalData, periodsAhead);
  const maPredictions = forecastMovingAverage(historicalData, periodsAhead, 7);
  
  // Combine predictions (simple average for now)
  const ensemblePredictions: PredictionResult[] = [];
  
  for (let i = 0; i < periodsAhead; i++) {
    const linearPred = linearPredictions[i];
    const maPred = maPredictions[i];
    
    const avgPrediction = (linearPred.predictedValue + maPred.predictedValue) / 2;
    const avgConfidence = (linearPred.confidenceScore + maPred.confidenceScore) / 2;
    
    // Combine confidence intervals
    const combinedLower = Math.min(linearPred.confidenceInterval.lower, maPred.confidenceInterval.lower);
    const combinedUpper = Math.max(linearPred.confidenceInterval.upper, maPred.confidenceInterval.upper);
    
    ensemblePredictions.push({
      predictedValue: avgPrediction,
      confidenceInterval: {
        lower: combinedLower,
        upper: combinedUpper
      },
      confidenceScore: avgConfidence,
      features: {
        models: ['linear_regression', 'moving_average'],
        linearPrediction: linearPred.predictedValue,
        maPrediction: maPred.predictedValue,
        linearConfidence: linearPred.confidenceScore,
        maConfidence: maPred.confidenceScore
      },
      modelName: 'ensemble',
      modelVersion: '1.0.0'
    });
  }
  
  return ensemblePredictions;
}

/**
 * Calculate correlation between two time series
 */
export function calculateCorrelation(
  series1: number[],
  series2: number[]
): number {
  if (series1.length !== series2.length) {
    throw new Error('Series must be the same length');
  }
  
  const n = series1.length;
  const mean1 = mean(series1);
  const mean2 = mean(series2);
  
  let numerator = 0;
  let sum1 = 0;
  let sum2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;
    numerator += diff1 * diff2;
    sum1 += diff1 * diff1;
    sum2 += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sum1 * sum2);
  
  return denominator === 0 ? 0 : numerator / denominator;
}

