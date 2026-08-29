import cron from 'node-cron';
import { processAutomatedAlerts } from '../services/burn-rate-predictor';
import { generateWeeklyForecastReport } from '../services/burn-rate-predictor';
import { logger } from '@/lib/logger';
import { JobCancellationService } from '../services/job-cancellation-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analytics Processor - Scheduled Jobs
 * 
 * Handles automated analytics processing:
 * - Hourly: Check for low balance alerts and trigger notifications
 * - Weekly: Generate forecast reports for all strike funds
 */

function generateJobIdempotencyKey(jobType: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${jobType}::${dateStr}`;
}

function toErrorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

/**
 * Process hourly alerts with Gate 13 execution tracking
 */
async function processHourlyAlertsWithTracking(params: {
  organizationId: string;
  executionTime?: Date;
}): Promise<{ success: boolean; alertsSent: number; error?: string }> {
  const { organizationId, executionTime = new Date() } = params;
  
  const jobCancellationService = new JobCancellationService();
  const jobRunId = uuidv4();
  const idempotencyKey = generateJobIdempotencyKey('analytics-hourly-alerts', executionTime);
  
  let executionStateId: string | undefined;
  
  try {
    // Start job execution tracking
    const executionState = await jobCancellationService.startJobExecution({
      organizationId,
      jobType: 'analytics-hourly-alerts',
      jobRunId,
      scheduledAt: executionTime,
      metadata: {
        executionTime: executionTime.toISOString(),
      },
    });
    executionStateId = executionState.id;
    
    const result = await processAutomatedAlerts({ organizationId });
    
    // Complete job execution tracking
    if (executionStateId) {
      await jobCancellationService.completeJob(organizationId, executionStateId, {
        alertsSent: result.alertsSent,
      });
    }
    
    return {
      success: true,
      alertsSent: result.alertsSent,
    };
  } catch (error) {
    // Record failure in job execution tracking
    if (executionStateId) {
      await jobCancellationService.failJob(organizationId, executionStateId, toErrorMeta(error));
    }
    
    return {
      success: false,
      alertsSent: 0,
      error: String(error),
    };
  }
}

/**
 * Process weekly forecast with Gate 13 execution tracking
 */
async function processWeeklyForecastWithTracking(params: {
  organizationId: string;
  executionTime?: Date;
}): Promise<{ success: boolean; reportsGenerated: number; error?: string }> {
  const { organizationId, executionTime = new Date() } = params;
  
  const jobCancellationService = new JobCancellationService();
  const jobRunId = uuidv4();
  const idempotencyKey = generateJobIdempotencyKey('analytics-weekly-forecast', executionTime);
  
  let executionStateId: string | undefined;
  
  try {
    // Start job execution tracking
    const executionState = await jobCancellationService.startJobExecution({
      organizationId,
      jobType: 'analytics-weekly-forecast',
      jobRunId,
      scheduledAt: executionTime,
      metadata: {
        executionTime: executionTime.toISOString(),
      },
    });
    executionStateId = executionState.id;
    
    const result = await generateWeeklyForecastReport({ organizationId });
    
    // Complete job execution tracking
    if (executionStateId) {
      await jobCancellationService.completeJob(organizationId, executionStateId, {
        totalFunds: result.totalFunds,
        criticalFunds: result.criticalFunds,
        warningFunds: result.warningFunds,
        reportGenerated: result.reportGenerated,
      });
    }
    
    return {
      success: true,
      reportsGenerated: result.reportGenerated ? 1 : 0,
    };
  } catch (error) {
    // Record failure in job execution tracking
    if (executionStateId) {
      await jobCancellationService.failJob(organizationId, executionStateId, toErrorMeta(error));
    }
    
    return {
      success: false,
      reportsGenerated: 0,
      error: String(error),
    };
  }
}

// Hourly alert processing (every hour at minute 0)
// Checks all strike funds for low balance conditions and sends alerts
export const hourlyAlertsJob = cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Starting hourly automated alerts check...');
    
    // Process alerts for all tenants
    // In production, this should iterate through active tenants
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Test tenant
    
    const result = await processHourlyAlertsWithTracking({ organizationId: tenantId });
    
    if (result.success) {
      logger.info(`Hourly alerts processed: ${result.alertsSent} alerts sent`);
    } else {
      logger.error('Hourly alerts processing failed', { error: result.error });
    }
  } catch (error) {
    logger.error('Error in hourly alerts job', { error });
  }
}, {
  timezone: 'America/Toronto', // Adjust to your timezone
});

// Weekly forecast report generation (Mondays at 9:00 AM)
// Generates comprehensive forecast reports for all strike funds
export const weeklyForecastJob = cron.schedule('0 9 * * 1', async () => {
  try {
    logger.info('Starting weekly forecast report generation...');
    
    // Generate reports for all tenants
    // In production, this should iterate through active tenants
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Test tenant
    
    const result = await processWeeklyForecastWithTracking({ organizationId: tenantId });
    
    if (result.success) {
      logger.info(`Weekly forecast report generated`, {
        reportsGenerated: result.reportsGenerated,
      });
    } else {
      logger.error('Weekly forecast processing failed', { error: result.error });
    }
  } catch (error) {
    logger.error('Error in weekly forecast job', { error });
  }
}, {
  timezone: 'America/Toronto', // Adjust to your timezone
});

/**
 * Start all scheduled jobs
 */
export function startAnalyticsJobs() {
  logger.info('Starting analytics scheduled jobs...');
  
  hourlyAlertsJob.start();
  logger.info('✓ Hourly alerts job started (runs every hour at :00)');
  
  weeklyForecastJob.start();
  logger.info('✓ Weekly forecast job started (runs Mondays at 9:00 AM)');
  
  return {
    hourlyAlertsJob,
    weeklyForecastJob,
  };
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
export function stopAnalyticsJobs() {
  logger.info('Stopping analytics scheduled jobs...');
  
  hourlyAlertsJob.stop();
  weeklyForecastJob.stop();
  
  logger.info('✓ All analytics jobs stopped');
}

/**
 * Get status of all scheduled jobs
 */
export function getJobsStatus() {
  return {
    hourlyAlerts: {
      running: true,
      schedule: '0 * * * * (every hour)',
    },
    weeklyForecast: {
      running: true,
      schedule: '0 9 * * 1 (Mondays at 9:00 AM)',
    },
  };
}
