/**
 * System Status Page
 *
 * The status of the services a deployment depends on, for the public status page (/api/status) and the GraphQL `systemStatus` query. Every service listed is
 * measured: the database with a query, and the cache, document storage and job backend with the probes /api/health and /api/ready use
 * (lib/operations/service-probes.ts). A service that is not configured is reported as degraded with the reason, never as operational.
 *
 * Usage:
 * ```typescript
 * // Get current status
 * const status = await getSystemStatus();
 *
 * // Check specific service
 * const dbHealth = await checkDatabaseHealth();
 *
 * // API endpoint: /api/status
 * ```
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { cache } from 'react';
import { getBuildMetadata } from '@nzila/os-core/health';
import { probeCache, probeQueue, probeStorage, type ProbeResult } from '@/lib/operations/service-probes';
import type { ServiceHealth, ServiceStatus, SystemStatus } from './status-utils';

// Re-export types so existing server-side imports still work
export type { ServiceStatus, ServiceHealth, SystemStatus };

/** What the running build calls itself: an operator's label, else the release or commit it was built from, else "unknown". Never an invented number. */
function runningVersion(): string {
  const label = process.env.APP_VERSION?.trim();
  if (label) return label;
  const build = getBuildMetadata('union-eyes');
  for (const candidate of [build.releaseId, build.gitSha]) {
    if (candidate && candidate !== 'unknown' && candidate !== 'local') return candidate;
  }
  return 'unknown';
}

/**
 * Get overall system status
 */
export const getSystemStatus = cache(async (): Promise<SystemStatus> => {
  try {
    // Check all services in parallel
    const [database, redis, storage, queue] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkStorageHealth(),
      checkQueueHealth(),
    ]);

    const services: ServiceHealth[] = [
      database.status === 'fulfilled' ? database.value : getFailedService('Database', database.reason),
      redis.status === 'fulfilled' ? redis.value : getFailedService('Redis', redis.reason),
      storage.status === 'fulfilled' ? storage.value : getFailedService('Storage', storage.reason),
      queue.status === 'fulfilled' ? queue.value : getFailedService('Queue', queue.reason),
    ];

    // Determine overall status
    const overallStatus = determineOverallStatus(services);

    return {
      status: overallStatus,
      services,
      uptime: process.uptime(),
      version: runningVersion(),
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to get system status', { error });

    return {
      status: 'down',
      services: [],
      uptime: process.uptime(),
      version: runningVersion(),
      timestamp: new Date(),
    };
  }
});

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Simple query to verify connection
    await db.execute(sql`SELECT 1 as health`);

    const responseTime = Date.now() - startTime;

    return {
      name: 'Database',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      message: responseTime < 1000 ? 'Operational' : 'Slow response time',
      lastChecked: new Date(),
    };
  } catch (error) {
    logger.error('Database health check failed', { error });

    return {
      name: 'Database',
      status: 'down',
      responseTime: Date.now() - startTime,
      message: 'Connection failed',
      lastChecked: new Date(),
    };
  }
}

function fromProbe(name: string, probe: ProbeResult): ServiceHealth {
  const status: ServiceStatus = probe.state === 'ok' ? 'healthy' : probe.state === 'fail' ? 'down' : 'degraded';
  return {
    name,
    status,
    ...(probe.ms === undefined ? {} : { responseTime: probe.ms }),
    message: probe.state === 'ok' ? 'Operational' : (probe.note ?? 'Not operational'),
    lastChecked: new Date(),
  };
}

/**
 * Check the shared store of the rate limiter (Upstash or Redis). Without it rate limiting is degraded, so the answer is degraded, not healthy.
 */
export async function checkRedisHealth(): Promise<ServiceHealth> {
  return fromProbe('Redis', await probeCache());
}

/**
 * Check document storage (the Azure Blob container member documents are written to)
 */
export async function checkStorageHealth(): Promise<ServiceHealth> {
  return fromProbe('Storage', await probeStorage());
}

/**
 * Check queue health: background jobs run in the Django backend, so this is the backend's own readiness
 */
export async function checkQueueHealth(): Promise<ServiceHealth> {
  return fromProbe('Queue', await probeQueue());
}

/**
 * Determine overall system status from services
 */
function determineOverallStatus(services: ServiceHealth[]): ServiceStatus {
  const statuses = services.map(s => s.status);

  // If any critical service is down
  if (statuses.includes('down')) {
    return 'down';
  }

  // If any service is degraded
  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Create failed service health object. The status is public: what went wrong is logged, never published (an error message can carry hosts and addresses).
 */
function getFailedService(name: string, error: unknown): ServiceHealth {
  logger.error('Service health check failed', { service: name, error });
  return {
    name,
    status: 'down',
    message: 'Health check failed',
    lastChecked: new Date(),
  };
}
