/**
 * Cleanup Worker - Processes maintenance and cleanup jobs
 * 
 * Handles periodic cleanup of old data, logs, and temporary files
 */

// Only import bullmq in runtime, not during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Worker: any, _Job: any, IORedis: any;

if (typeof window === 'undefined' && !process.env.__NEXT_BUILDING) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bullmq = require('bullmq');
    Worker = bullmq.Worker;
    _Job = bullmq.Job;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    IORedis = require('ioredis');
  } catch (_e) {
    // Fail silently during build
  }
}

import { db } from '../../db/db';
import { auditLogs } from '../../db/schema/audit-security-schema';
import { notificationHistory } from '../../db/schema/notifications-schema';
import { lt } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const REPORTS_DIR = process.env.REPORTS_DIR || './reports';
const TEMP_DIR = process.env.TEMP_DIR || './temp';

/**
 * PR #11: Archive old audit logs (immutable audit trail)
 * Marks logs as archived instead of deleting for compliance.
 */
async function cleanupLogs(olderThanDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
const result = await db
    .update(auditLogs)
    .set({
      archived: true,
      archivedAt: new Date(),
      archivedPath: null, // Can be set to S3/filesystem path in future
    })
    .where(lt(auditLogs.createdAt, cutoffDate));
return { archived: result.rowCount || 0 };
}

/**
 * Clean up old notification history
 */
async function _cleanupNotificationHistory(olderThanDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
const result = await db
    .delete(notificationHistory)
    .where(lt(notificationHistory.sentAt, cutoffDate));
return { deleted: result.length };
}

/**
 * Clean up old sessions
 */
async function cleanupSessions() {
try {
    // Import user session schema dynamically to avoid build issues
    const { userSessions } = await import('../../db/schema/user-management-schema');
    
    // Delete expired sessions from database
    const result = await db
      .delete(userSessions)
      .where(lt(userSessions.expiresAt, new Date()));

    const deletedCount = result.rowCount || 0;
// Also clean up inactive sessions older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const inactiveResult = await db
      .delete(userSessions)
      .where(
        lt(userSessions.lastUsedAt, ninetyDaysAgo)
      );

    const inactiveCount = inactiveResult.rowCount || 0;
return { deleted: deletedCount + inactiveCount };
  } catch (_error) {
return { deleted: 0 };
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles(olderThanDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffTime = cutoffDate.getTime();
let deleted = 0;

  try {
    const files = await fs.readdir(TEMP_DIR);

    for (const file of files) {
      const filepath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filepath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filepath);
        deleted++;
      }
    }
  } catch (_error) {
}
return { deleted };
}

/**
 * Clean up old exported reports
 */
async function cleanupExports(olderThanDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffTime = cutoffDate.getTime();
let deleted = 0;

  try {
    const files = await fs.readdir(REPORTS_DIR);

    for (const file of files) {
      const filepath = path.join(REPORTS_DIR, file);
      const stats = await fs.stat(filepath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filepath);
        deleted++;
      }
    }
  } catch (_error) {
}
return { deleted };
}

/**
 * Process cleanup job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processCleanupJob(job: any) {
  const { target, olderThanDays } = job.data;
await job.updateProgress(10);

  let result;

  switch (target) {
    case 'logs':
      result = await cleanupLogs(olderThanDays);
      break;

    case 'sessions':
      result = await cleanupSessions();
      break;

    case 'temp-files':
      result = await cleanupTempFiles(olderThanDays);
      break;

    case 'exports':
      result = await cleanupExports(olderThanDays);
      break;

    default:
      throw new Error(`Unknown cleanup target: ${target}`);
  }

  await job.updateProgress(100);
return {
    success: true,
    target,
    ...result,
  };
}

// Create worker
export const cleanupWorker = new Worker(
  'cleanup',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    return await processCleanupJob(job);
  },
  {
    connection,
    concurrency: 1, // Run cleanup jobs sequentially
  }
);

// Event handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
cleanupWorker.on('completed', (_job: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
cleanupWorker.on('failed', (_job: any, _err: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
cleanupWorker.on('error', (_err: any) => {
});

// Graceful shutdown
async function shutdown() {
await cleanupWorker.close();
  await connection.quit();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

