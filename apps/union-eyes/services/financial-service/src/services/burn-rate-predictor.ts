/**
 * AI Burn-Rate Predictor Service
 * Week 9-10: Predict fund depletion using historical data and ML-based forecasting
 * 
 * Features:
 * - Historical trend analysis
 * - Seasonal pattern detection
 * - Multi-scenario forecasting (optimistic, realistic, pessimistic)
 * - Early warning system
 * - Automated alert generation
 */

import { db } from '../db';
import { 
  strikeFunds, 
  donations, 
  stipendDisbursements,
  _notificationQueue 
} from '../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { queueNotification } from './notification-service';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BurnRateData {
  date: Date;
  balance: number;
  deposits: number;
  withdrawals: number;
  netChange: number;
  runRate: number; // Daily average burn rate
}

interface ForecastScenario {
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
  projectedBalance: number[];
  depletionDate: Date | null;
  daysRemaining: number | null;
  confidence: number;
  assumptions: {
    dailyBurnRate: number;
    weeklyDonations: number;
    monthlyStipends: number;
  };
}

interface BurnRateForecast {
  fundId: string;
  fundName: string;
  currentBalance: number;
  asOfDate: Date;
  historicalBurnRate: number;
  scenarios: ForecastScenario[];
  recommendations: string[];
  alerts: {
    severity: 'info' | 'warning' | 'critical';
    message: string;
    daysUntilDepletion: number | null;
  }[];
}

interface SeasonalPattern {
  month: number;
  avgBurnRate: number;
  avgDonations: number;
  variance: number;
}

// ============================================================================
// HISTORICAL DATA ANALYSIS
// ============================================================================

/**
 * Get historical burn rate data for a strike fund
 */
export async function getHistoricalBurnRate(
  organizationId: string,
  fundId: string,
  startDate: Date,
  endDate: Date
): Promise<BurnRateData[]> {
  // Get donations (deposits)
  const donationHistory = await db
    .select({
      date: sql<string>`DATE(${donations.createdAt})`,
      amount: sql<number>`COALESCE(SUM(CAST(${donations.amount} AS NUMERIC)), 0)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.tenantId, organizationId),
        eq(donations.strikeFundId, fundId),
        eq(donations.status, 'completed'),
        gte(donations.createdAt, startDate.toISOString()),
        lte(donations.createdAt, endDate.toISOString())
      )
    )
    .groupBy(sql<string>`DATE(${donations.createdAt})`);

  // Get stipend disbursements (withdrawals)
  const stipendHistory = await db
    .select({
      date: sql<string>`DATE(${stipendDisbursements.createdAt})`,
      amount: sql<number>`COALESCE(SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(stipendDisbursements)
    .where(
      and(
        eq(stipendDisbursements.tenantId, organizationId),
        eq(stipendDisbursements.strikeFundId, fundId),
        eq(stipendDisbursements.status, 'paid'),
        gte(stipendDisbursements.createdAt, startDate.toISOString()),
        lte(stipendDisbursements.createdAt, endDate.toISOString())
      )
    )
    .groupBy(sql<string>`DATE(${stipendDisbursements.createdAt})`);

  // Combine and calculate daily burn rate
  const dataMap = new Map<string, BurnRateData>();
  
  // Add donations (deposits)
  donationHistory.forEach((record) => {
    const dateKey = record.date;
    dataMap.set(dateKey, {
      date: new Date(record.date),
      balance: 0, // Will calculate running balance later
      deposits: Number(record.amount),
      withdrawals: 0,
      netChange: Number(record.amount),
      runRate: 0,
    });
  });

  // Add stipends (withdrawals)
  stipendHistory.forEach((record) => {
    const dateKey = record.date;
    const existing = dataMap.get(dateKey);
    if (existing) {
      existing.withdrawals = Number(record.amount);
      existing.netChange = existing.deposits - Number(record.amount);
    } else {
      dataMap.set(dateKey, {
        date: new Date(record.date),
        balance: 0,
        deposits: 0,
        withdrawals: Number(record.amount),
        netChange: -Number(record.amount),
        runRate: 0,
      });
    }
  });

  // Calculate net change, running balance, and 7-day moving average
  const sortedData = Array.from(dataMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  let runningBalance = 0;
  for (let i = 0; i < sortedData.length; i++) {
    const record = sortedData[i];
    runningBalance += record.netChange;
    record.balance = runningBalance;
    
    // Calculate 7-day moving average burn rate
    const lookback = Math.min(7, i + 1);
    const recentRecords = sortedData.slice(Math.max(0, i - lookback + 1), i + 1);
    const avgWithdrawals = recentRecords.reduce((sum, r) => sum + r.withdrawals, 0) / lookback;
    record.runRate = avgWithdrawals;
  }

  return sortedData;
}

/**
 * Detect seasonal patterns in burn rate
 */
export async function detectSeasonalPatterns(
  organizationId: string,
  fundId: string
): Promise<SeasonalPattern[]> {
  // Get 12 months of historical data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);

  const historicalData = await getHistoricalBurnRate(organizationId, fundId, startDate, endDate);

  // Group by month
  const monthlyData = new Map<number, { burnRates: number[]; donations: number[] }>();

  historicalData.forEach((record) => {
    const month = record.date.getMonth();
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { burnRates: [], donations: [] });
    }
    const data = monthlyData.get(month)!;
    data.burnRates.push(record.runRate);
    data.donations.push(record.deposits);
  });

  // Calculate averages and variance for each month
  const patterns: SeasonalPattern[] = [];
  for (let month = 0; month < 12; month++) {
    const data = monthlyData.get(month) || { burnRates: [0], donations: [0] };
    const avgBurnRate = data.burnRates.reduce((a, b) => a + b, 0) / data.burnRates.length;
    const avgDonations = data.donations.reduce((a, b) => a + b, 0) / data.donations.length;
    
    // Calculate variance
    const variance =
      data.burnRates.reduce((sum, rate) => sum + Math.pow(rate - avgBurnRate, 2), 0) /
      data.burnRates.length;

    patterns.push({
      month,
      avgBurnRate,
      avgDonations,
      variance,
    });
  }

  return patterns;
}

// ============================================================================
// FORECASTING ENGINE
// ============================================================================

/**
 * Generate multi-scenario forecast
 */
export async function generateBurnRateForecast(
  organizationId: string,
  fundId: string,
  forecastDays: number = 90
): Promise<BurnRateForecast> {
  // Get current fund data
  const [fund] = await db
    .select()
    .from(strikeFunds)
    .where(and(eq(strikeFunds.tenantId, organizationId), eq(strikeFunds.id, fundId)))
    .limit(1);

  if (!fund) {
    throw new Error('Strike fund not found');
  }

  // Calculate current balance from all-time donations - stipends
  const [balanceResult] = await db
    .select({
      totalDonations: sql<number>`COALESCE(SUM(CAST(${donations.amount} AS NUMERIC)), 0)`,
      totalStipends: sql<number>`COALESCE(SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(donations)
    .leftJoin(
      stipendDisbursements,
      and(
        eq(stipendDisbursements.tenantId, organizationId),
        eq(stipendDisbursements.strikeFundId, fundId),
        eq(stipendDisbursements.status, 'paid')
      )
    )
    .where(and(eq(donations.tenantId, organizationId), eq(donations.strikeFundId, fundId), eq(donations.status, 'completed')));

  const currentBalance = Number(balanceResult.totalDonations) - Number(balanceResult.totalStipends);
  const targetAmount = fund.targetAmount ? Number(fund.targetAmount) : currentBalance * 2; // Default to 2x current if not set

  // Get historical data (90 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const historicalData = await getHistoricalBurnRate(organizationId, fundId, startDate, endDate);
  const seasonalPatterns = await detectSeasonalPatterns(organizationId, fundId);

  // Calculate historical averages
  const avgDailyBurnRate =
    historicalData.length > 0
      ? historicalData.reduce((sum, d) => sum + d.withdrawals, 0) / historicalData.length
      : 0;
  const avgDailyDonations =
    historicalData.length > 0
      ? historicalData.reduce((sum, d) => sum + d.deposits, 0) / historicalData.length
      : 0;

  // Get current month's seasonal adjustment
  const currentMonth = new Date().getMonth();
  const seasonalAdjustment = seasonalPatterns[currentMonth];

  // Generate three scenarios
  const scenarios: ForecastScenario[] = [
    generateScenario(
      'optimistic',
      currentBalance,
      avgDailyBurnRate * 0.7, // 30% lower burn rate
      avgDailyDonations * 1.3, // 30% higher donations
      forecastDays,
      seasonalAdjustment
    ),
    generateScenario(
      'realistic',
      currentBalance,
      avgDailyBurnRate,
      avgDailyDonations,
      forecastDays,
      seasonalAdjustment
    ),
    generateScenario(
      'pessimistic',
      currentBalance,
      avgDailyBurnRate * 1.3, // 30% higher burn rate
      avgDailyDonations * 0.7, // 30% lower donations
      forecastDays,
      seasonalAdjustment
    ),
  ];

  // Generate recommendations
  const recommendations = generateRecommendations(
    currentBalance,
    targetAmount,
    scenarios,
    avgDailyBurnRate,
    avgDailyDonations
  );

  // Generate alerts
  const alerts = generateAlerts(currentBalance, scenarios, avgDailyBurnRate);

  return {
    fundId: fund.id,
    fundName: fund.fundName,
    currentBalance,
    asOfDate: new Date(),
    historicalBurnRate: avgDailyBurnRate,
    scenarios,
    recommendations,
    alerts,
  };
}

/**
 * Generate a single forecast scenario
 */
function generateScenario(
  scenario: 'optimistic' | 'realistic' | 'pessimistic',
  currentBalance: number,
  dailyBurnRate: number,
  dailyDonations: number,
  forecastDays: number,
  seasonalAdjustment: SeasonalPattern
): ForecastScenario {
  const projectedBalance: number[] = [currentBalance];
  let balance = currentBalance;
  let depletionDate: Date | null = null;
  let daysRemaining: number | null = null;

  for (let day = 1; day <= forecastDays; day++) {
    // Apply seasonal adjustment
    const adjustedBurnRate = dailyBurnRate * (1 + seasonalAdjustment.variance / 100);
    const adjustedDonations = dailyDonations * (seasonalAdjustment.avgDonations / dailyDonations);

    // Weekly stipend disbursement pattern (assume stipends every 7 days)
    const isDisbursementDay = day % 7 === 0;
    const weeklyStipendAmount = isDisbursementDay ? adjustedBurnRate * 7 : 0;

    // Daily operations
    balance = balance + adjustedDonations - adjustedBurnRate - weeklyStipendAmount;
    projectedBalance.push(Math.max(0, balance));

    // Check for depletion
    if (balance <= 0 && depletionDate === null) {
      depletionDate = new Date();
      depletionDate.setDate(depletionDate.getDate() + day);
      daysRemaining = day;
      break;
    }
  }

  // Calculate confidence based on historical variance
  const confidence = Math.max(0.5, 1 - seasonalAdjustment.variance / 100);

  return {
    scenario,
    projectedBalance,
    depletionDate,
    daysRemaining,
    confidence,
    assumptions: {
      dailyBurnRate,
      weeklyDonations: dailyDonations * 7,
      monthlyStipends: dailyBurnRate * 30,
    },
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  currentBalance: number,
  targetAmount: number,
  scenarios: ForecastScenario[],
  avgDailyBurnRate: number,
  avgDailyDonations: number
): string[] {
  const recommendations: string[] = [];
  const realisticScenario = scenarios.find((s) => s.scenario === 'realistic')!;

  // Balance recommendations
  const balanceRatio = currentBalance / targetAmount;
  if (balanceRatio < 0.25) {
    recommendations.push(
      `CRITICAL: Current balance is ${(balanceRatio * 100).toFixed(1)}% of target. Immediate fundraising required.`
    );
  } else if (balanceRatio < 0.5) {
    recommendations.push(
      `WARNING: Current balance is ${(balanceRatio * 100).toFixed(1)}% of target. Increase fundraising efforts.`
    );
  }

  // Depletion warnings
  if (realisticScenario.daysRemaining !== null) {
    if (realisticScenario.daysRemaining < 30) {
      recommendations.push(
        `URGENT: Fund may deplete in ${realisticScenario.daysRemaining} days. Emergency fundraising campaign needed.`
      );
    } else if (realisticScenario.daysRemaining < 60) {
      recommendations.push(
        `Fund projected to deplete in ${realisticScenario.daysRemaining} days. Start fundraising campaign now.`
      );
    }
  }

  // Burn rate recommendations
  const burnRateRatio = avgDailyBurnRate / avgDailyDonations;
  if (burnRateRatio > 2) {
    recommendations.push(
      `Burn rate is ${burnRateRatio.toFixed(1)}x higher than donation rate. Consider reducing stipend amounts or increasing donation drive.`
    );
  }

  // Donation recommendations
  const requiredDailyDonations = avgDailyBurnRate * 1.2; // 20% buffer
  if (avgDailyDonations < requiredDailyDonations) {
    const shortfall = requiredDailyDonations - avgDailyDonations;
    recommendations.push(
      `Need $${shortfall.toFixed(2)}/day more in donations to maintain sustainable operations.`
    );
  }

  // Positive reinforcement
  if (recommendations.length === 0) {
    recommendations.push(
      'Fund is healthy. Current donation and burn rates are sustainable for the forecast period.'
    );
  }

  return recommendations;
}

/**
 * Generate automated alerts
 */
function generateAlerts(
  currentBalance: number,
  scenarios: ForecastScenario[],
  avgDailyBurnRate: number
): BurnRateForecast['alerts'] {
  const alerts: BurnRateForecast['alerts'] = [];
  const realisticScenario = scenarios.find((s) => s.scenario === 'realistic')!;
  const pessimisticScenario = scenarios.find((s) => s.scenario === 'pessimistic')!;

  // Critical: Less than 30 days in pessimistic scenario
  if (pessimisticScenario.daysRemaining !== null && pessimisticScenario.daysRemaining < 30) {
    alerts.push({
      severity: 'critical',
      message: `CRITICAL: Fund may deplete in ${pessimisticScenario.daysRemaining} days (pessimistic scenario)`,
      daysUntilDepletion: pessimisticScenario.daysRemaining,
    });
  }

  // Warning: Less than 60 days in realistic scenario
  if (realisticScenario.daysRemaining !== null && realisticScenario.daysRemaining < 60) {
    alerts.push({
      severity: 'warning',
      message: `WARNING: Fund projected to deplete in ${realisticScenario.daysRemaining} days`,
      daysUntilDepletion: realisticScenario.daysRemaining,
    });
  }

  // Low balance warning
  const daysOfRunway = currentBalance / avgDailyBurnRate;
  if (daysOfRunway < 45) {
    alerts.push({
      severity: 'warning',
      message: `Low balance alert: Only ${daysOfRunway.toFixed(0)} days of runway remaining`,
      daysUntilDepletion: Math.floor(daysOfRunway),
    });
  }

  // Info: Healthy fund
  if (alerts.length === 0) {
    alerts.push({
      severity: 'info',
      message: 'Fund health is good. No immediate concerns.',
      daysUntilDepletion: null,
    });
  }

  return alerts;
}

// ============================================================================
// AUTOMATED ALERT SYSTEM
// ============================================================================

/**
 * Check all funds and send alerts if needed
 */
export async function processAutomatedAlerts(params: { organizationId: string }): Promise<{
  success: boolean;
  alertsSent: number;
  alerts?: Array<{ fundId: string; fundName: string; severity: string; message: string }>;
}> {
  const { organizationId } = params;
  
  // Get all strike funds
  const activeFunds = await db
    .select()
    .from(strikeFunds)
    .where(eq(strikeFunds.tenantId, organizationId));

  let alertsSent = 0;
  const allAlerts: Array<{ fundId: string; fundName: string; severity: string; message: string }> = [];

  for (const fund of activeFunds) {
    try {
      const forecast = await generateBurnRateForecast(organizationId, fund.id);

      // Send alerts for critical and warning severities
      for (const alert of forecast.alerts) {
        if (alert.severity === 'critical' || alert.severity === 'warning') {
          // Queue notification to fund administrators
          await queueNotification({
            organizationId,
            userId: fund.createdBy || 'admin', // Send to fund creator or admin
            type: 'low_balance_alert',
            channels: ['email', 'sms'],
            priority: alert.severity === 'critical' ? 'urgent' : 'high',
            data: {
              fundName: fund.fundName,
              currentBalance: `$${forecast.currentBalance.toFixed(2)}`,
              daysRemaining: alert.daysUntilDepletion?.toString() || 'Unknown',
              message: alert.message,
              forecastUrl: `${process.env.APP_URL}/funds/${fund.id}/forecast`,
            },
          });
          alertsSent++;
          allAlerts.push({
            fundId: fund.id,
            fundName: fund.fundName,
            severity: alert.severity,
            message: alert.message,
          });
        }
      }
    } catch (error) {
      logger.error('Error processing alerts for fund', { error, fundId: fund.id, organizationId });
    }
  }

  return {
    success: true,
    alertsSent,
    alerts: allAlerts,
  };
}

/**
 * Generate weekly forecast report for all funds
 */
export async function generateWeeklyForecastReport(params: {
  organizationId: string;
  recipientUserId?: string;
}): Promise<{
  success: boolean;
  reportGenerated: boolean;
  totalFunds: number;
  criticalFunds: number;
  warningFunds: number;
}> {
  const { organizationId, recipientUserId = 'admin' } = params;
  const activeFunds = await db
    .select()
    .from(strikeFunds)
    .where(eq(strikeFunds.tenantId, organizationId));

  const forecasts = await Promise.all(
    activeFunds.map((fund) => generateBurnRateForecast(organizationId, fund.id))
  );

  // Generate report summary
  const reportData = {
    generatedDate: new Date().toISOString(),
    totalFunds: forecasts.length,
    criticalFunds: forecasts.filter((f) =>
      f.alerts.some((a) => a.severity === 'critical')
    ).length,
    warningFunds: forecasts.filter((f) =>
      f.alerts.some((a) => a.severity === 'warning')
    ).length,
    healthyFunds: forecasts.filter((f) =>
      f.alerts.every((a) => a.severity === 'info')
    ).length,
    forecasts: forecasts.map((f) => ({
      fundName: f.fundName,
      currentBalance: f.currentBalance,
      daysRemaining: f.scenarios.find((s) => s.scenario === 'realistic')?.daysRemaining,
      alerts: f.alerts,
    })),
  };

  // Send weekly report via email
  await queueNotification({
    organizationId,
    userId: recipientUserId,
    type: 'strike_announcement', // Reusing type for report
    channels: ['email'],
    priority: 'normal',
    data: {
      title: 'Weekly Fund Forecast Report',
      message: `Weekly forecast report generated with ${reportData.criticalFunds} critical alerts and ${reportData.warningFunds} warnings.`,
      reportUrl: `${process.env.APP_URL}/reports/weekly-forecast`,
      reportData: JSON.stringify(reportData),
    },
  });

  return {
    success: true,
    reportGenerated: true,
    totalFunds: reportData.totalFunds,
    criticalFunds: reportData.criticalFunds,
    warningFunds: reportData.warningFunds,
  };
}
