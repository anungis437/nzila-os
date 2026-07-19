/**
 * Continuity Forecasting Models
 *
 * Predictive models for organizational continuity degradation trends.
 * Forecast concentration growth, fragility accumulation, governance drift.
 */

export interface ContinuityTrendPoint {
  /** Date of measurement */
  date: string;
  /** Continuity health score (0-100) */
  healthScore: number;
  /** Number of single-source knowledge areas */
  singleSourceCount: number;
  /** Average redundancy across all knowledge areas */
  averageRedundancy: number;
  /** Governance documentation maturity (0-100) */
  governanceMaturity: number;
  /** Vendor concentration risk (0-100) */
  vendorConcentrationRisk: number;
  /** Undocumented workflow prevalence (0-100) */
  undocumentedWorkflowRisk: number;
}

export interface ContinuityForecast {
  organizationId: string;
  generatedAt: string;
  baselineDate: string;
  /** Historical data points (last 12 months if available) */
  historicalData: ContinuityTrendPoint[];
  /** Projected data points (next 12 months) */
  projections: ContinuityTrendPoint[];
  /** Overall trend direction */
  trendDirection: 'improving' | 'stable' | 'degrading';
  /** Confidence in forecast (0-100) */
  confidence: number;
  /** Key risks being tracked */
  trackedRisks: Array<{
    riskType: 'concentration_growth' | 'redundancy_erosion' | 'governance_drift' | 'documentation_degradation' | 'vendor_risk';
    currentValue: number;
    projectedValue: number;
    /** Whether trend is favorable (low value) or unfavorable (high value) */
    isFavorable: boolean;
    trajectory: 'improving' | 'stable' | 'degrading';
  }>;
  /** Critical thresholds being approached */
  approachingThresholds: string[];
  /** Recommended interventions based on forecast */
  recommendations: string[];
  /** When critical thresholds will be crossed (if current trend continues) */
  forecastedCrisisDate?: string;
}

export interface ForecastConfidenceMetrics {
  /** Number of data points used to train forecast */
  dataPointCount: number;
  /** How well historical model fits historical data (R²) */
  modelFitQuality: number; // 0-100
  /** Volatility of historical data (affects forecast uncertainty) */
  dataVolatility: number; // 0-100
  /** Number of interviews available for trend analysis */
  interviewCount: number;
}

/**
 * Calculate concentration growth rate based on historical data.
 * Returns monthly growth rate (negative = improving, positive = worsening).
 */
export function calculateConcentrationGrowthRate(
  currentSingleSourceCount: number,
  previousSingleSourceCount: number,
  totalKnowledgeAreas: number,
): number {
  if (totalKnowledgeAreas === 0) return 0;
  const currentConcentration = currentSingleSourceCount / totalKnowledgeAreas;
  const previousConcentration = previousSingleSourceCount / totalKnowledgeAreas;
  return (currentConcentration - previousConcentration) * 100; // Percentage point change
}

/**
 * Estimate how fast undocumented workflows accumulate over time.
 */
export function projectUndocumentedWorkflowGrowth(
  currentUndocumentedRisk: number,
  monthsIntoPast: number,
  growthRate: number, // percentage points per month
): number[] {
  const projections: number[] = [];
  let current = currentUndocumentedRisk;

  for (let month = 1; month <= 12; month++) {
    current = Math.min(current + (growthRate / 100) * current, 100);
    projections.push(Math.round(current));
  }

  return projections;
}

/**
 * Estimate governance maturity erosion if no action taken.
 * Governance maturity naturally decays as staff turns over and processes drift.
 */
export function projectGovernanceErosion(
  currentMaturity: number,
  monthsSinceLastAudit: number,
): number {
  // Baseline decay: 2% per month without maintenance
  const eroded = currentMaturity * Math.pow(0.98, Math.min(monthsSinceLastAudit, 12));
  return Math.max(eroded, 10); // Never below 10%
}

/**
 * Estimate how redundancy erodes if no cross-training happens.
 */
export function projectRedundancyErosion(
  currentAverageRedundancy: number,
  turnoverRatePercentPerMonth: number,
  retrainingRate: number, // How much new training offsets turnover (0-1)
): number[] {
  const projections: number[] = [];
  let current = currentAverageRedundancy;

  for (let month = 1; month <= 12; month++) {
    // Each person lost reduces redundancy
    const loss = current * (turnoverRatePercentPerMonth / 100);
    const regain = loss * retrainingRate;
    current = Math.max(current - loss + regain, 1);
    projections.push(Math.round(current * 10) / 10);
  }

  return projections;
}

/**
 * Estimate vendor concentration risk growth.
 * Risk grows as vendor relationships become more entrenched/undocumented.
 */
export function projectVendorConcentrationRisk(
  currentRisk: number,
  vendorCount: number,
  documentationQuality: 'minimal' | 'partial' | 'good',
): number[] {
  const projections: number[] = [];
  let current = currentRisk;

  // Risk grows slower if documentation is good, faster if minimal
  const growthRate = documentationQuality === 'minimal' ? 2 : documentationQuality === 'partial' ? 1 : 0.3;

  for (let month = 1; month <= 12; month++) {
    current = Math.min(current + growthRate, 100);
    projections.push(Math.round(current));
  }

  return projections;
}

/**
 * Overall continuity health forecast based on component trends.
 * Combines: concentration, redundancy, governance maturity, documentation.
 */
export function forecastContinuityHealth(
  concentration: number,
  redundancy: number,
  governanceMaturity: number,
  documentationQuality: number,
): number {
  // Health is weighted average of components
  const health =
    (100 - concentration) * 0.3 + // Lower concentration = better
    redundancy * 0.2 + // Higher redundancy = better
    governanceMaturity * 0.25 + // Higher governance maturity = better
    documentationQuality * 0.25; // Higher documentation = better

  return Math.max(0, Math.min(health, 100));
}

/**
 * Detect when forecast is approaching a critical threshold.
 */
export function identifyApproachingThresholds(forecast: ContinuityForecast): string[] {
  const thresholds: string[] = [];

  for (const risk of forecast.trackedRisks) {
    if (risk.projectedValue >= 75 && risk.projectedValue < 85 && !risk.isFavorable) {
      thresholds.push(`${risk.riskType} approaching warning threshold (${Math.round(risk.projectedValue)}%)`);
    }
    if (risk.projectedValue >= 85 && !risk.isFavorable) {
      thresholds.push(`CRITICAL: ${risk.riskType} above warning threshold (${Math.round(risk.projectedValue)}%)`);
    }
  }

  // Check overall health
  const finalHealthScore = forecast.projections[forecast.projections.length - 1]?.healthScore ?? 50;
  if (finalHealthScore < 40) {
    thresholds.push('CRITICAL: Overall continuity health projected below resilience threshold');
  }

  return thresholds;
}

/**
 * Estimate when a critical threshold will be crossed based on current trend.
 */
export function estimateCrisisDate(
  currentValue: number,
  projectionRate: number, // Change per month
  criticalThreshold: number,
  _direction: 'increasing' | 'decreasing',
): Date | null {
  if (projectionRate === 0) return null;

  const monthsToThreshold = Math.abs((criticalThreshold - currentValue) / projectionRate);
  if (monthsToThreshold > 24) return null; // Beyond forecast horizon

  const crisisDate = new Date();
  crisisDate.setMonth(crisisDate.getMonth() + Math.ceil(monthsToThreshold));
  return crisisDate;
}
