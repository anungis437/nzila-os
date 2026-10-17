/**
 * Financial Service - Main Entry Point
 *
 * Microservice handling:
 * - Dues calculations and management
 * - Employer remittance processing
 * - Arrears tracking and collections
 * - Strike fund operations
 * - Payment integrations (Stripe)
 *
 * Port: 3007
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

// Route imports
import duesRulesRouter from './routes/dues-rules'
import duesAssignmentsRouter from './routes/dues-assignments'
import duesTransactionsRouter from './routes/dues-transactions'
import remittancesRouter from './routes/remittances'
import arrearsRouter from './routes/arrears'
import strikeFundsRouter from './routes/strike-funds'
import donationsRouter from './routes/donations'
import reportsRouter from './routes/reports'
import picketTrackingRouter from './routes/picket-tracking'
import stipendsRouter from './routes/stipends'
import paymentsRouter from './routes/payments'
import notificationsRouter from './routes/notifications'
import analyticsRouter from './routes/analytics'
import employerTimesheetsRouter from './routes/employer-timesheets'
import employerPayrollRunsRouter from './routes/employer-payroll-runs'
import employerRemittanceRunsRouter from './routes/employer-remittance-runs'
import employerComplianceRouter from './routes/employer-compliance'
import employerReplayRouter from './routes/employer-replay'
import { startAnalyticsJobs, stopAnalyticsJobs } from './jobs/analytics-processor'
import {
  startDuesCalculationWorkflow,
  stopDuesCalculationWorkflow,
} from './jobs/dues-calculation-workflow'
import {
  startArrearsManagementWorkflow,
  stopArrearsManagementWorkflow,
} from './jobs/arrears-management-workflow'
import {
  startPaymentCollectionWorkflow,
  stopPaymentCollectionWorkflow,
} from './jobs/payment-collection-workflow'
import {
  startStipendProcessingWorkflow,
  stopStipendProcessingWorkflow,
} from './jobs/stipend-processing-workflow'
import { requireIdempotencyKey } from './middleware/idempotency'
import { authenticate, requireFinancialSystemAdministrator } from './middleware/authentication'
import { parseFinancialRequestBody } from './middleware/request-body'
import { runReconciliation } from './services/reconciliation-engine'
import { logger } from '@/lib/logger'

dotenv.config()

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express()
const PORT = process.env.PORT || 3007

// Security middleware
app.use(helmet())

// CORS configuration with origin whitelist (Security Hardened - Feb 2026)
const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || ''

  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:3001']
  }

  if (!originsEnv) {
    logger.warn('⚠️  CORS_ALLOWED_ORIGINS not configured - CORS disabled')
    return []
  }

  return originsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins()

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('CORS policy: Origin not allowed'))
      }
    },
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
})
app.use('/api/', limiter)

// Body parsing - Stripe webhook needs raw body
app.use(parseFinancialRequestBody)

// Idempotency-Key enforcement on mutating endpoints (skip webhooks/health)
app.use('/api/', requireIdempotencyKey)

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })
  next()
})

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'financial-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// ============================================================================
// API ROUTES
// ============================================================================

// Dues Management
app.use('/api/dues/rules', authenticate, duesRulesRouter)
app.use('/api/dues/assignments', authenticate, duesAssignmentsRouter)
app.use('/api/dues/transactions', authenticate, duesTransactionsRouter)

// Remittance Processing
app.use('/api/remittances', authenticate, remittancesRouter)

// Arrears Management
app.use('/api/arrears', authenticate, arrearsRouter)

// Strike Funds
app.use('/api/strike-funds', authenticate, strikeFundsRouter)

// Picket Tracking
app.use('/api/picket', authenticate, picketTrackingRouter)

// Stipend Management
app.use('/api/stipends', authenticate, stipendsRouter)

// Payment Processing
app.use('/api/payments/dues', authenticate)
app.use('/api/payments/stipends', authenticate)
app.use('/api/payments/summary', authenticate)
app.use('/api/payments', paymentsRouter)

// Notification System
app.use('/api/notifications', authenticate, notificationsRouter)

// Analytics & Forecasting
app.use('/api/analytics', authenticate, analyticsRouter)

// Financial Reports (authentication applied)
app.use('/api/reports', authenticate, reportsRouter)

// Employer Execution
app.use('/api/employer-execution/timesheets', authenticate, employerTimesheetsRouter)
app.use('/api/employer-execution/payroll-runs', authenticate, employerPayrollRunsRouter)
app.use('/api/employer-execution/remittance-runs', authenticate, employerRemittanceRunsRouter)
app.use('/api/employer-execution/compliance', authenticate, employerComplianceRouter)
app.use('/api/employer-execution/replay', authenticate, employerReplayRouter)

// Public Donations (no auth required for donations)
app.use('/api/donations', donationsRouter)

// Reconciliation endpoint (admin-only)
app.post(
  '/api/reconciliation/run',
  authenticate,
  requireFinancialSystemAdministrator,
  async (req: Request, res: Response) => {
    try {
      const { periodStart, periodEnd } = req.body || {}
      const end = periodEnd || new Date().toISOString()
      const start = periodStart || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const report = await runReconciliation(start, end)
      res.json({ success: true, report })
    } catch (error) {
      logger.error('Reconciliation failed', { error })
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      })
    }
  },
)

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  })
})

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  logger.info(`Financial service started on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info('Available endpoints:')
  logger.info('  - GET  /health')
  logger.info('  - POST /api/dues/rules')
  logger.info('  - GET  /api/dues/rules')
  logger.info('  - POST /api/dues/assignments')
  logger.info('  - POST /api/dues/transactions/calculate')
  logger.info('  - POST /api/dues/transactions/batch')
  logger.info('  - POST /api/remittances')
  logger.info('  - GET  /api/arrears')
  logger.info('  - POST /api/strike-funds')
  logger.info('  - POST /api/donations')

  // Start scheduled jobs and workflows
  if (process.env.ENABLE_SCHEDULED_JOBS !== 'false') {
    try {
      // Analytics jobs (hourly alerts, weekly forecasts)
      startAnalyticsJobs()
      logger.info('✓ Analytics scheduled jobs started')

      // Workflow automation (dues, arrears, payments, stipends)
      startDuesCalculationWorkflow()
      startArrearsManagementWorkflow()
      startPaymentCollectionWorkflow()
      startStipendProcessingWorkflow()
      logger.info('✓ All automated workflows started (4 workflows)')
    } catch (error) {
      logger.error('Failed to start scheduled jobs/workflows', { error })
    }
  } else {
    logger.info('Scheduled jobs and workflows disabled (ENABLE_SCHEDULED_JOBS=false)')
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')

  // Stop scheduled jobs and workflows
  try {
    stopAnalyticsJobs()
    stopDuesCalculationWorkflow()
    stopArrearsManagementWorkflow()
    stopPaymentCollectionWorkflow()
    stopStipendProcessingWorkflow()
    logger.info('✓ All scheduled jobs and workflows stopped')
  } catch (error) {
    logger.error('Error stopping scheduled jobs/workflows', { error })
  }

  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')

  // Stop scheduled jobs and workflows
  try {
    stopAnalyticsJobs()
    stopDuesCalculationWorkflow()
    stopArrearsManagementWorkflow()
    stopPaymentCollectionWorkflow()
    stopStipendProcessingWorkflow()
    logger.info('✓ All scheduled jobs and workflows stopped')
  } catch (error) {
    logger.error('Error stopping scheduled jobs/workflows', { error })
  }

  process.exit(0)
})

export default app
