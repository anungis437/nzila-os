/**
 * Scheduled Jobs Configuration for Analytics
 * 
 * Configures cron jobs and background tasks for analytics
 * 
 * Features:
 * - Daily aggregation updates
 * - Cache warming
 * - Metric pre-computation
 * - Performance monitoring
 * 
 * Created: November 15, 2025
 */

import { aggregationService } from '@/lib/analytics-aggregation';
import { warmAnalyticsCache, getAnalyticsCacheStats } from '@/lib/analytics-middleware';
import { db } from '@/db';
import { claims } from '@/db/schema/domains/claims';
import { sql } from 'drizzle-orm';
import { logger } from './logger';
interface JobConfig {
  name: string;
  schedule: string; // Cron expression
  handler: () => Promise<void>;
  enabled: boolean;
}

/**
 * Daily aggregation job
 * Runs at 2 AM every day
 */
const dailyAggregationJob: JobConfig = {
  name: 'daily-aggregation',
  schedule: '0 2 * * *', // 2 AM daily
  handler: async () => {
    logger.info('CRON: Starting daily aggregation job');
    try {
      await aggregationService.runDailyAggregations();
      logger.info('CRON: Daily aggregation completed successfully');
    } catch (error) {
      logger.error('CRON: Daily aggregation failed', error);
      // Alert sent via Sentry integration
    }
  },
  enabled: true,
};

/**
 * Cache warming job
 * Runs every 30 minutes
 */
const cacheWarmingJob: JobConfig = {
  name: 'cache-warming',
  schedule: '*/30 * * * *', // Every 30 minutes
  handler: async () => {
    logger.info('CRON: Starting cache warming job');
    try {
      // Get all active tenants
      const tenants = await db
        .selectDistinct({ organizationId: claims.organizationId })
        .from(claims);

      for (const { organizationId } of tenants) {
        await warmAnalyticsCache(organizationId);
      }

      logger.info('CRON: Cache warming completed', { tenantCount: tenants.length });
    } catch (error) {
      logger.error('CRON: Cache warming failed', error);
    }
  },
  enabled: true,
};

/**
 * Cache statistics reporting job
 * Runs every hour
 */
const cacheStatsJob: JobConfig = {
  name: 'cache-stats',
  schedule: '0 * * * *', // Every hour
  handler: async () => {
    const stats = getAnalyticsCacheStats();
    logger.info('CRON: Cache statistics', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      size: stats.size,
    });
  },
  enabled: true,
};

/**
 * Database statistics update job
 * Runs at 3 AM every Sunday
 */
const dbStatsJob: JobConfig = {
  name: 'db-stats-update',
  schedule: '0 3 * * 0', // 3 AM every Sunday
  handler: async () => {
    logger.info('CRON: Starting database statistics update');
    try {
      // Update PostgreSQL statistics for query planner
      await db.execute(sql`ANALYZE claims`);
      await db.execute(sql`ANALYZE members`);
      await db.execute(sql`ANALYZE claim_updates`);
      
      logger.info('CRON: Database statistics updated successfully');
    } catch (error) {
      logger.error('CRON: Database statistics update failed', error);
    }
  },
  enabled: true,
};

/**
 * Materialized view refresh job
 * Runs at 1 AM daily
 */
const refreshMaterializedViewsJob: JobConfig = {
  name: 'refresh-materialized-views',
  schedule: '0 1 * * *', // 1 AM daily
  handler: async () => {
    logger.info('CRON: Starting materialized view refresh');
    try {
      // Refresh daily analytics summary
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_summary`);
      logger.info('CRON: Refreshed analytics_daily_summary');

      // Refresh member analytics summary
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_member_summary`);
      logger.info('CRON: Refreshed analytics_member_summary');

      logger.info('CRON: All materialized views refreshed successfully');
    } catch (error) {
      logger.error('CRON: Materialized view refresh failed', error);
    }
  },
  enabled: true,
};

/**
 * Old cache cleanup job
 * Runs every 6 hours
 */
const cacheCleanupJob: JobConfig = {
  name: 'cache-cleanup',
  schedule: '0 */6 * * *', // Every 6 hours
  handler: async () => {
    logger.info('CRON: Running cache cleanup');
    // The cache service automatically cleans up expired entries
    // This job is for logging and monitoring
    const stats = getAnalyticsCacheStats();
    logger.info('CRON: Cache cleanup complete', { size: stats.size });
  },
  enabled: true,
};

// All jobs configuration
export const analyticsJobs: JobConfig[] = [
  dailyAggregationJob,
  cacheWarmingJob,
  cacheStatsJob,
  dbStatsJob,
  refreshMaterializedViewsJob,
  cacheCleanupJob,
];

/**
 * Initialize scheduled jobs
 * Call this from your application startup
 */
export function initializeAnalyticsJobs() {
  logger.info('Initializing analytics scheduled jobs');
  
  const enabledJobs = analyticsJobs.filter(job => job.enabled);
  logger.info('Enabled analytics jobs', { 
    count: enabledJobs.length,
    jobs: enabledJobs.map(j => j.name)
  });

  // Integrate with node-cron for scheduled job execution
  if (typeof window === 'undefined') { // Server-side only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cron = require('node-cron');
    
    enabledJobs.forEach(job => {
      const _task = cron.schedule(job.schedule, async () => {
        logger.info('CRON: Starting job', { jobName: job.name });
        try {
          await job.handler();
        } catch (error) {
          logger.error('CRON: Job failed', error, { jobName: job.name });
        }
      }, {
        scheduled: true,
        timezone: "America/Toronto" // Adjust based on your requirements
      });
      
      logger.info('Scheduled job', { jobName: job.name, schedule: job.schedule });
    });
  }

  return enabledJobs;
}

/**
 * Run a specific job manually (for testing/debugging)
 */
export async function runJobManually(jobName: string): Promise<void> {
  const job = analyticsJobs.find(j => j.name === jobName);
  if (!job) {
    throw new Error(`Job not found: ${jobName}`);
  }

  logger.info('Manually running job', { jobName });
  await job.handler();
}

/**
 * Get job status
 */
export function getJobsStatus() {
  return analyticsJobs.map(job => ({
    name: job.name,
    schedule: job.schedule,
    enabled: job.enabled,
  }));
}

