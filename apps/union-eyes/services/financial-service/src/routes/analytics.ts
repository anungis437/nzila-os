/**
 * Analytics & Forecasting Routes
 * Week 9-10: Financial analytics and burn-rate prediction endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  generateBurnRateForecast,
  getHistoricalBurnRate,
  detectSeasonalPatterns,
  processAutomatedAlerts,
  generateWeeklyForecastReport,
} from '../services/burn-rate-predictor';
import { db } from '../db';
import {
  strikeFunds,
  donations,
  duesTransactions,
  stipendDisbursements,
} from '../db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ForecastParamsSchema = z.object({
  fundId: z.string().uuid(),
  forecastDays: z.coerce.number().min(7).max(365).optional().default(90),
});

const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const _AlertsSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

const getOrganizationIdFromHeaders = (req: Request): string | undefined =>
  (req.headers['x-organization-id'] as string) || (req.headers['x-tenant-id'] as string);

// ============================================================================
// BURN-RATE FORECASTING ENDPOINTS
// ============================================================================

/**
 * GET /api/analytics/forecast/:fundId
 * Generate burn-rate forecast for a specific fund
 */
router.get('/forecast/:fundId', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const { fundId, forecastDays } = ForecastParamsSchema.parse({
      fundId: req.params.fundId,
      forecastDays: req.query.forecastDays,
    });

    const forecast = await generateBurnRateForecast(organizationId as string, fundId, forecastDays);

    res.json({
      success: true,
      forecast,
    });
  } catch (error) {
    logger.error('Error generating forecast', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate forecast',
    });
  }
});

/**
 * GET /api/analytics/historical/:fundId
 * Get historical burn rate data
 */
router.get('/historical/:fundId', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const fundId = req.params.fundId;
    
    const { startDate, endDate } = DateRangeSchema.parse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    const historicalData = await getHistoricalBurnRate(
      organizationId as string,
      fundId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: historicalData,
      count: historicalData.length,
    });
  } catch (error) {
    logger.error('Error fetching historical data', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch historical data',
    });
  }
});

/**
 * GET /api/analytics/seasonal/:fundId
 * Get seasonal patterns for a fund
 */
router.get('/seasonal/:fundId', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const fundId = req.params.fundId;

    const patterns = await detectSeasonalPatterns(organizationId as string, fundId);

    res.json({
      success: true,
      patterns,
    });
  } catch (error) {
    logger.error('Error detecting seasonal patterns', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect patterns',
    });
  }
});

/**
 * POST /api/analytics/alerts/process
 * Process automated alerts for all funds (admin/cron)
 */
router.post('/alerts/process', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);

    const alertsSent = await processAutomatedAlerts({ organizationId: organizationId as string });

    res.json({
      success: true,
      alertsSent,
      message: `Processed alerts for organization. ${alertsSent} alerts sent.`,
    });
  } catch (error) {
    logger.error('Error processing alerts', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process alerts',
    });
  }
});

/**
 * POST /api/analytics/reports/weekly
 * Generate weekly forecast report
 */
router.post('/reports/weekly', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required',
      });
    }

    await generateWeeklyForecastReport({ organizationId: organizationId as string });

    res.json({
      success: true,
      message: 'Weekly forecast report generated and queued for delivery',
    });
  } catch (error) {
    logger.error('Error generating weekly report', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
    });
  }
});

// ============================================================================
// FINANCIAL ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/analytics/summary
 * Get financial summary for the tenant
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);

    // Get total funds
    const [fundsData] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(strikeFunds)
      .where(eq(strikeFunds.tenantId, organizationId as string));

    // Calculate total balance from all donations - all stipends
    const [balanceData] = await db
      .select({
        totalDonations: sql<number>`COALESCE(SUM(CAST(${donations.amount} AS NUMERIC)), 0)`,
      })
      .from(donations)
      .where(and(eq(donations.tenantId, organizationId as string), eq(donations.status, 'completed')));

    const [stipendData] = await db
      .select({
        totalStipends: sql<number>`COALESCE(SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC)), 0)`,
      })
      .from(stipendDisbursements)
      .where(and(eq(stipendDisbursements.tenantId, organizationId as string), eq(stipendDisbursements.status, 'paid')));

    const totalBalance = Number(balanceData.totalDonations) - Number(stipendData.totalStipends);

    // Get total target amount across all funds (column doesn't exist yet, using 0)
    const targetData = { totalTarget: 0 };

    // Get total donations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [donationsData] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`SUM(CAST(${donations.amount} AS NUMERIC))`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.tenantId, organizationId as string),
          eq(donations.status, 'completed'),
          gte(donations.createdAt, thirtyDaysAgo.toISOString())
        )
      );

    // Get total stipends (last 30 days)
    const [stipendsData] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC))`,
      })
      .from(stipendDisbursements)
      .where(
        and(
          eq(stipendDisbursements.tenantId, organizationId as string),
          eq(stipendDisbursements.status, 'paid'),
          gte(stipendDisbursements.createdAt, thirtyDaysAgo.toISOString())
        )
      );

    // Get dues collected (last 30 days)
    const [duesData] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(CAST(${duesTransactions.amount} AS NUMERIC)), 0)`,
      })
      .from(duesTransactions)
      .where(
        and(
          eq(duesTransactions.organizationId, organizationId as string),
          eq(duesTransactions.status, 'completed'),
          gte(duesTransactions.createdAt, thirtyDaysAgo.toISOString())
        )
      );

    const summary = {
      strikeFunds: {
        count: Number(fundsData.count),
        totalBalance,
        totalTarget: Number(targetData.totalTarget),
        percentOfTarget: targetData.totalTarget > 0
          ? ((totalBalance / Number(targetData.totalTarget)) * 100).toFixed(1)
          : '0',
      },
      last30Days: {
        donations: {
          count: Number(donationsData?.count || 0),
          total: Number(donationsData?.total || 0),
        },
        stipends: {
          count: Number(stipendsData?.count || 0),
          total: Number(stipendsData?.total || 0),
        },
        duesCollected: {
          count: Number(duesData?.count || 0),
          total: Number(duesData?.total || 0),
        },
        netCashFlow: Number(donationsData?.total || 0) + Number(duesData?.total || 0) - Number(stipendsData?.total || 0),
      },
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Error fetching financial summary', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch summary',
    });
  }
});

/**
 * GET /api/analytics/trends
 * Get financial trends over time
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const days = parseInt(req.query.days as string) || 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Daily donations trend
    const donationsTrend = await db
      .select({
        date: sql<string>`DATE(${donations.createdAt})`,
        amount: sql<number>`SUM(CAST(${donations.amount} AS NUMERIC))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.tenantId, organizationId as string),
          eq(donations.status, 'completed'),
          gte(donations.createdAt, startDate.toISOString())
        )
      )
      .groupBy(sql<string>`DATE(${donations.createdAt})`)
      .orderBy(sql<string>`DATE(${donations.createdAt})`);

    // Daily stipends trend
    const stipendsTrend = await db
      .select({
        date: sql<string>`DATE(${stipendDisbursements.createdAt})`,
        amount: sql<number>`SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(stipendDisbursements)
      .where(
        and(
          eq(stipendDisbursements.tenantId, organizationId as string),
          eq(stipendDisbursements.status, 'paid'),
          gte(stipendDisbursements.createdAt, startDate.toISOString())
        )
      )
      .groupBy(sql<string>`DATE(${stipendDisbursements.createdAt})`)
      .orderBy(sql<string>`DATE(${stipendDisbursements.createdAt})`);

    res.json({
      success: true,
      trends: {
        donations: donationsTrend.map((d) => ({
          date: d.date,
          amount: Number(d.amount),
          count: Number(d.count),
        })),
        stipends: stipendsTrend.map((s) => ({
          date: s.date,
          amount: Number(s.amount),
          count: Number(s.count),
        })),
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        days,
      },
    });
  } catch (error) {
    logger.error('Error fetching trends', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch trends',
    });
  }
});

/**
 * GET /api/analytics/top-donors
 * Get top donors by contribution amount
 */
router.get('/top-donors', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const limit = parseInt(req.query.limit as string) || 10;

    const topDonors = await db
      .select({
        donorEmail: donations.donorEmail,
        donorName: donations.donorName,
        totalAmount: sql<number>`SUM(CAST(${donations.amount} AS NUMERIC))`,
        donationCount: sql<number>`COUNT(*)`,
        lastDonation: sql<Date>`MAX(${donations.createdAt})`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.tenantId, organizationId as string),
          eq(donations.status, 'completed'),
          eq(donations.isAnonymous, false)
        )
      )
      .groupBy(donations.donorEmail, donations.donorName)
      .orderBy(desc(sql`SUM(CAST(${donations.amount} AS NUMERIC))`))
      .limit(limit);

    res.json({
      success: true,
      topDonors: topDonors.map((donor) => ({
        donorEmail: donor.donorEmail,
        donorName: donor.donorName,
        totalAmount: Number(donor.totalAmount),
        donationCount: Number(donor.donationCount),
        lastDonation: donor.lastDonation,
      })),
    });
  } catch (error) {
    logger.error('Error fetching top donors', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch top donors',
    });
  }
});

/**
 * GET /api/analytics/fund-health
 * Get health status for all funds
 */
router.get('/fund-health', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);

    const funds = await db
      .select()
      .from(strikeFunds)
      .where(eq(strikeFunds.organizationId, organizationId as string));

    const fundHealth = await Promise.all(
      funds.map(async (fund) => {
        try {
          // Calculate current balance for this fund
          const [balanceData] = await db
            .select({
              totalDonations: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'completed' THEN CAST(${donations.amount} AS NUMERIC) ELSE 0 END), 0)`,
              totalStipends: sql<number>`COALESCE(SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC)), 0)`,
            })
            .from(donations)
            .leftJoin(stipendDisbursements, eq(donations.strikeFundId, stipendDisbursements.strikeFundId))
            .where(eq(donations.strikeFundId, fund.id));

          const currentBalance = Number(balanceData?.totalDonations || 0) - Number(balanceData?.totalStipends || 0);
          const targetAmount = Number(fund.targetAmount || currentBalance * 2);

          const forecast = await generateBurnRateForecast(organizationId as string, fund.id, 90);
          const realisticScenario = forecast.scenarios.find((s) => s.scenario === 'realistic');
          
          return {
            fundId: fund.id,
            fundName: fund.fundName,
            currentBalance: Number(currentBalance.toFixed(2)),
            targetAmount: Number(targetAmount.toFixed(2)),
            percentOfTarget: targetAmount > 0 ? ((currentBalance / targetAmount) * 100).toFixed(1) : '0.0',
            daysRemaining: realisticScenario?.daysRemaining ?? null,
            healthStatus:
              !realisticScenario || realisticScenario?.daysRemaining === null
                ? 'healthy'
                : realisticScenario?.daysRemaining < 30
                ? 'critical'
                : realisticScenario?.daysRemaining < 60
                ? 'warning'
                : 'healthy',
            alerts: forecast.alerts,
          };
        } catch (_error) {
          // Fallback for funds without forecasts - calculate balance
          const [balanceData] = await db
            .select({
              totalDonations: sql<number>`COALESCE(SUM(CASE WHEN ${donations.status} = 'completed' THEN CAST(${donations.amount} AS NUMERIC) ELSE 0 END), 0)`,
              totalStipends: sql<number>`COALESCE(SUM(CAST(${stipendDisbursements.totalAmount} AS NUMERIC)), 0)`,
            })
            .from(donations)
            .leftJoin(stipendDisbursements, eq(donations.strikeFundId, stipendDisbursements.strikeFundId))
            .where(eq(donations.strikeFundId, fund.id));

          const currentBalance = Number(balanceData?.totalDonations || 0) - Number(balanceData?.totalStipends || 0);
          const targetAmount = Number(fund.targetAmount || currentBalance * 2);

          return {
            fundId: fund.id,
            fundName: fund.fundName,
            currentBalance: Number(currentBalance.toFixed(2)),
            targetAmount: Number(targetAmount.toFixed(2)),
            percentOfTarget: targetAmount > 0 ? ((currentBalance / targetAmount) * 100).toFixed(1) : '0.0',
            daysRemaining: null,
            healthStatus: 'unknown',
            alerts: [],
            error: 'Failed to generate forecast',
          };
        }
      })
    );

    res.json({
      success: true,
      funds: fundHealth,
      summary: {
        total: fundHealth.length,
        healthy: fundHealth.filter((f) => f.healthStatus === 'healthy').length,
        warning: fundHealth.filter((f) => f.healthStatus === 'warning').length,
        critical: fundHealth.filter((f) => f.healthStatus === 'critical').length,
      },
    });
  } catch (error) {
    logger.error('Error fetching fund health', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch fund health',
    });
  }
});

export default router;
