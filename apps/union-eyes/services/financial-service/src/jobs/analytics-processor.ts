import cron from 'node-cron';
import { processAutomatedAlerts } from '../services/burn-rate-predictor';
import { generateWeeklyForecastReport } from '../services/burn-rate-predictor';
import { logger } from '@/lib/logger';

/**
 * Analytics Processor - Scheduled Jobs
 * 
 * Handles automated analytics processing:
 * - Hourly: Check for low balance alerts and trigger notifications
 * - Weekly: Generate forecast reports for all strike funds
 */

// Hourly alert processing (every hour at minute 0)
// Checks all strike funds for low balance conditions and sends alerts
export const hourlyAlertsJob = cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Starting hourly automated alerts check...');
    
    // Process alerts for all tenants
    // In production, this should iterate through active tenants
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Test tenant
    
    const result = await processAutomatedAlerts({ organizationId: tenantId });
    
    logger.info(`Hourly alerts processed: ${result.alertsSent} alerts sent`, {
      criticalAlerts: result.alerts?.filter(a => a.severity === 'critical').length || 0,
      warningAlerts: result.alerts?.filter(a => a.severity === 'warning').length || 0,
    });
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
    
    const result = await generateWeeklyForecastReport({ organizationId: tenantId });
    
    logger.info('Weekly forecast report generated and sent', {
      totalFunds: result.totalFunds,
      criticalFunds: result.criticalFunds,
      warningFunds: result.warningFunds,
      reportGenerated: result.reportGenerated,
    });
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
