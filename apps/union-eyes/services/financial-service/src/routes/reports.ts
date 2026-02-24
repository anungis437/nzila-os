import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getCollectionMetrics,
  getArrearsStatistics,
  getRevenueAnalysis,
  getMemberPaymentPatterns,
  getFinancialDashboard,
} from '../services/financial-reports';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// Auth middleware interfaces (same as in index.ts)
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organizationId?: string;
    tenantId?: string;
    role: string;
    permissions: string[];
  };
}

// Role-based authorization (assumes authenticate middleware already ran)
const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }
    next();
  };
};

// Date range schema for validation
const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/**
 * GET /api/reports/dashboard
 * Get comprehensive financial dashboard
 */
router.get(
  '/dashboard',
  authorize(['admin', 'financial_admin', 'financial_viewer']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;

      // Default to last 30 days if not specified
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string)
        : new Date();
      
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dashboard = await getFinancialDashboard(organizationId, {
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Dashboard error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to generate dashboard',
      });
    }
  }
);

/**
 * GET /api/reports/collection-metrics
 * Get dues collection metrics for a date range
 */
router.get(
  '/collection-metrics',
  authorize(['admin', 'financial_admin', 'financial_viewer']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;

      const validation = dateRangeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          details: validation.error.errors,
        });
      }

      const { startDate, endDate } = validation.data;

      const metrics = await getCollectionMetrics(organizationId, {
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Collection metrics error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate collection metrics',
      });
    }
  }
);

/**
 * GET /api/reports/arrears-statistics
 * Get current arrears statistics
 */
router.get(
  '/arrears-statistics',
  authorize(['admin', 'financial_admin', 'financial_viewer']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;

      const statistics = await getArrearsStatistics(organizationId);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Arrears statistics error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate arrears statistics',
      });
    }
  }
);

/**
 * GET /api/reports/revenue-analysis
 * Get revenue trends and analysis
 */
router.get(
  '/revenue-analysis',
  authorize(['admin', 'financial_admin', 'financial_viewer']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;

      const validation = dateRangeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          details: validation.error.errors,
        });
      }

      const { startDate, endDate } = validation.data;

      const analysis = await getRevenueAnalysis(organizationId, {
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      logger.error('Revenue analysis error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze revenue',
      });
    }
  }
);

/**
 * GET /api/reports/member-payment-patterns
 * Get member payment patterns and reliability scores
 */
router.get(
  '/member-payment-patterns',
  authorize(['admin', 'financial_admin', 'financial_viewer']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;

      const validation = dateRangeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          details: validation.error.errors,
        });
      }

      const { startDate, endDate } = validation.data;
      const limit = req.query.limit 
        ? Math.min(parseInt(req.query.limit as string), 1000)
        : 100;

      const patterns = await getMemberPaymentPatterns(
        organizationId,
        { startDate, endDate },
        limit
      );

      res.json({
        success: true,
        data: {
          patterns,
          count: patterns.length,
          limit,
        },
      });
    } catch (error) {
      logger.error('Member payment patterns error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze member payment patterns',
      });
    }
  }
);

/**
 * GET /api/reports/export
 * Export financial report data in various formats
 */
router.get(
  '/export',
  authorize(['admin', 'financial_admin']),
  async (req, res) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { organizationId: organizationIdFromUser, tenantId: legacyTenantId } = (req as any).user!;
      const organizationId = organizationIdFromUser ?? legacyTenantId;
      const format = (req.query.format as string) || 'json';
      const reportType = req.query.type as string;

      if (!reportType) {
        return res.status(400).json({
          success: false,
          error: 'Report type is required',
        });
      }

      const validation = dateRangeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          details: validation.error.errors,
        });
      }

      const { startDate, endDate } = validation.data;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;

      switch (reportType) {
        case 'dashboard':
          data = await getFinancialDashboard(organizationId, { startDate, endDate });
          break;
        case 'collection':
          data = await getCollectionMetrics(organizationId, { startDate, endDate });
          break;
        case 'arrears':
          data = await getArrearsStatistics(organizationId);
          break;
        case 'revenue':
          data = await getRevenueAnalysis(organizationId, { startDate, endDate });
          break;
        case 'patterns':
          data = await getMemberPaymentPatterns(organizationId, { startDate, endDate }, 1000);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type',
          });
      }

      if (format === 'csv') {
        // Convert to CSV (simplified)
        const csv = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${reportType}-report-${Date.now()}.csv"`
        );
        res.send(csv);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${reportType}-report-${Date.now()}.json"`
        );
        res.json({
          success: true,
          reportType,
          dateRange: { startDate, endDate },
          data,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Export error', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export report',
      });
    }
  }
);

/**
 * Simple CSV converter for export
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertToCSV(data: any): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => 
      Object.values(item).map(val => 
        typeof val === 'string' ? `"${val}"` : val
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  } else {
    // For single objects, convert to key-value pairs
    const rows = Object.entries(data).map(([key, value]) => 
      `"${key}","${value}"`
    );
    return ['Field,Value', ...rows].join('\n');
  }
}

export default router;
