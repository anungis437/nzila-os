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

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';
import { verifyToken } from '@clerk/backend';

// Route imports
import duesRulesRouter from './routes/dues-rules';
import duesAssignmentsRouter from './routes/dues-assignments';
import duesTransactionsRouter from './routes/dues-transactions';
import remittancesRouter from './routes/remittances';
import arrearsRouter from './routes/arrears';
import strikeFundsRouter from './routes/strike-funds';
import donationsRouter from './routes/donations';
import reportsRouter from './routes/reports';
import picketTrackingRouter from './routes/picket-tracking';
import stipendsRouter from './routes/stipends';
import paymentsRouter from './routes/payments';
import notificationsRouter from './routes/notifications';
import analyticsRouter from './routes/analytics';
import { startAnalyticsJobs, stopAnalyticsJobs } from './jobs/analytics-processor';
import { startDuesCalculationWorkflow, stopDuesCalculationWorkflow } from './jobs/dues-calculation-workflow';
import { startArrearsManagementWorkflow, stopArrearsManagementWorkflow } from './jobs/arrears-management-workflow';
import { startPaymentCollectionWorkflow, stopPaymentCollectionWorkflow } from './jobs/payment-collection-workflow';
import { startStipendProcessingWorkflow, stopStipendProcessingWorkflow } from './jobs/stipend-processing-workflow';
import { logger } from '@/lib/logger';

dotenv.config();

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3007;

// Security middleware
app.use(helmet());

// CORS configuration with origin whitelist (Security Hardened - Feb 2026)
const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
  
  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  
  if (!originsEnv) {
    logger.warn('⚠️  CORS_ALLOWED_ORIGINS not configured - CORS disabled');
    return [];
  }
  
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean);
};

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing - Stripe webhook needs raw body
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl === '/api/donations/webhooks/stripe') {
    next(); // Skip body parsing for Stripe webhook
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    role: string;
    permissions: string[];
  };
}

const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Development bypass for testing
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-user']) {
      try {
        req.user = JSON.parse(req.headers['x-test-user'] as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        logger.info('Development auth bypass used', { userId: (req as any).user?.id });
        return next();
      } catch (_error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid X-Test-User header format. Expected JSON string.',
        });
      }
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }
    
    const token = authHeader.substring(7);
    
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const { payload } = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });

        // Type assertion for JWT payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jwtPayload = payload as Record<string, any>;

        req.user = {
          id: jwtPayload.sub as string,
          tenantId: jwtPayload.tenant_id as string,
          role: jwtPayload.org_role as string,
          permissions: (jwtPayload.org_permissions as string[]) || [],
        };

        return next();
      } catch (error) {
        logger.warn('Clerk token verification failed', { error });
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
      }
    }

    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      req.user = {
        id: payload.sub,
        tenantId: payload.tenant_id,
        role: payload.org_role,
        permissions: payload.org_permissions || [],
      };

      next();
    } catch (_error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
      });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

const _requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredRoles: roles,
      });
    }
    
    next();
  };
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'financial-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

// Dues Management
app.use('/api/dues/rules', authenticate, duesRulesRouter);
app.use('/api/dues/assignments', authenticate, duesAssignmentsRouter);
app.use('/api/dues/transactions', authenticate, duesTransactionsRouter);

// Remittance Processing
app.use('/api/remittances', authenticate, remittancesRouter);

// Arrears Management
app.use('/api/arrears', authenticate, arrearsRouter);

// Strike Funds
app.use('/api/strike-funds', authenticate, strikeFundsRouter);

// Picket Tracking
app.use('/api/picket', authenticate, picketTrackingRouter);

// Stipend Management
app.use('/api/stipends', authenticate, stipendsRouter);

// Payment Processing
app.use('/api/payments', paymentsRouter); // Note: Some endpoints allow public access

// Notification System
app.use('/api/notifications', authenticate, notificationsRouter);

// Analytics & Forecasting
app.use('/api/analytics', authenticate, analyticsRouter);

// Financial Reports (authentication applied)
app.use('/api/reports', authenticate, reportsRouter);

// Public Donations (no auth required for donations)
app.use('/api/donations', donationsRouter);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  logger.info(`Financial service started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Available endpoints:');
  logger.info('  - GET  /health');
  logger.info('  - POST /api/dues/rules');
  logger.info('  - GET  /api/dues/rules');
  logger.info('  - POST /api/dues/assignments');
  logger.info('  - POST /api/dues/transactions/calculate');
  logger.info('  - POST /api/dues/transactions/batch');
  logger.info('  - POST /api/remittances');
  logger.info('  - GET  /api/arrears');
  logger.info('  - POST /api/strike-funds');
  logger.info('  - POST /api/donations');
  
  // Start scheduled jobs and workflows
  if (process.env.ENABLE_SCHEDULED_JOBS !== 'false') {
    try {
      // Analytics jobs (hourly alerts, weekly forecasts)
      startAnalyticsJobs();
      logger.info('✓ Analytics scheduled jobs started');
      
      // Workflow automation (dues, arrears, payments, stipends)
      startDuesCalculationWorkflow();
      startArrearsManagementWorkflow();
      startPaymentCollectionWorkflow();
      startStipendProcessingWorkflow();
      logger.info('✓ All automated workflows started (4 workflows)');
    } catch (error) {
      logger.error('Failed to start scheduled jobs/workflows', { error });
    }
  } else {
    logger.info('Scheduled jobs and workflows disabled (ENABLE_SCHEDULED_JOBS=false)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop scheduled jobs and workflows
  try {
    stopAnalyticsJobs();
    stopDuesCalculationWorkflow();
    stopArrearsManagementWorkflow();
    stopPaymentCollectionWorkflow();
    stopStipendProcessingWorkflow();
    logger.info('✓ All scheduled jobs and workflows stopped');
  } catch (error) {
    logger.error('Error stopping scheduled jobs/workflows', { error });
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop scheduled jobs and workflows
  try {
    stopAnalyticsJobs();
    stopDuesCalculationWorkflow();
    stopArrearsManagementWorkflow();
    stopPaymentCollectionWorkflow();
    stopStipendProcessingWorkflow();
    logger.info('✓ All scheduled jobs and workflows stopped');
  } catch (error) {
    logger.error('Error stopping scheduled jobs/workflows', { error });
  }
  
  process.exit(0);
});

export default app;

