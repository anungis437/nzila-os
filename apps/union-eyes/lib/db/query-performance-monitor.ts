/**
 * Query Performance Monitoring
 * 
 * Tracks slow queries, provides detailed performance analysis,
 * and integrates with observability stack.
 * 
 * Features:
 * - Automatic slow query logging (configurable threshold)
 * - Query execution time tracking
 * - Query pattern analysis
 * - Integration with Prometheus metrics
 * - Automatic recommendations for optimization
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { dbQueryDuration } from '@/lib/observability/metrics';
import { logger } from '@/lib/logger';

export interface QueryPerformanceConfig {
  /**
   * Threshold in milliseconds to log slow queries
   * @default 100
   */
  slowQueryThreshold: number;
  
  /**
   * Enable query pattern analysis
   * @default true
   */
  enablePatternAnalysis: boolean;
  
  /**
   * Sample rate for query logging (0-1)
   * @default 1.0 (log all slow queries)
   */
  sampleRate: number;
  
  /**
   * Maximum query length to log
   * @default 500
   */
  maxQueryLength: number;
}

export interface SlowQueryLog {
  query: string;
  durationMs: number;
  timestamp: Date;
  parameters?: any[];
  stackTrace?: string;
  recommendation?: string;
}

export interface QueryPattern {
  pattern: string;
  count: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastSeen: Date;
}

// Default configuration
const defaultConfig: QueryPerformanceConfig = {
  slowQueryThreshold: 100, // 100ms
  enablePatternAnalysis: true,
  sampleRate: 1.0,
  maxQueryLength: 500
};

// In-memory store for query patterns (consider Redis for distributed systems)
function createQueryPatternStore() {
  return new Map<string, QueryPattern>();
}
const queryPatterns = createQueryPatternStore();
const recentSlowQueries: SlowQueryLog[] = [];
const MAX_SLOW_QUERY_HISTORY = 100;

/**
 * Wrap a database query with performance monitoring
 * 
 * @example
 * ```typescript
 * const users = await withQueryMonitoring(
 *   'getUsersByOrganization',
 *   () => db.query.users.findMany({
 *     where: eq(users.organizationId, orgId)
 *   })
 * );
 * ```
 */
export async function withQueryMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  config: Partial<QueryPerformanceConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const durationMs = Date.now() - startTime;
    
    // Record metrics
    dbQueryDuration.observe({ operation: queryName }, durationMs / 1000);
    
    // Check if slow query
    if (durationMs >= finalConfig.slowQueryThreshold) {
      // Sample based on rate
      if (Math.random() <= finalConfig.sampleRate) {
        logSlowQuery({
          query: queryName,
          durationMs,
          timestamp: new Date()
        }, finalConfig);
      }
    }
    
    // Update query patterns
    if (finalConfig.enablePatternAnalysis) {
      updateQueryPattern(queryName, durationMs);
    }
    
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    // Log failed query
    logger.error('Query execution failed', {
      queryName,
      durationMs,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}

/**
 * Log slow query with context and recommendations
 */
function logSlowQuery(log: SlowQueryLog, config: QueryPerformanceConfig): void {
  // Truncate query if needed
  const truncatedQuery = log.query.length > config.maxQueryLength
    ? log.query.substring(0, config.maxQueryLength) + '...'
    : log.query;
  
  // Generate recommendation
  const recommendation = generateRecommendation(log);
  
  const enrichedLog = {
    ...log,
    query: truncatedQuery,
    recommendation
  };
  
  // Log to console/file
  logger.warn('Slow query detected', enrichedLog);
  
  // Store in history
  recentSlowQueries.push(enrichedLog);
  if (recentSlowQueries.length > MAX_SLOW_QUERY_HISTORY) {
    recentSlowQueries.shift();
  }
}

/**
 * Update query pattern statistics
 */
function updateQueryPattern(pattern: string, durationMs: number): void {
  const existing = queryPatterns.get(pattern);
  
  if (existing) {
    existing.count++;
    existing.avgDurationMs = (existing.avgDurationMs * (existing.count - 1) + durationMs) / existing.count;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
    existing.lastSeen = new Date();
  } else {
    queryPatterns.set(pattern, {
      pattern,
      count: 1,
      avgDurationMs: durationMs,
      maxDurationMs: durationMs,
      lastSeen: new Date()
    });
  }
}

/**
 * Generate optimization recommendation based on query characteristics
 */
function generateRecommendation(log: SlowQueryLog): string {
  const { query, durationMs } = log;
  const queryLower = query.toLowerCase();
  
  // Check for common performance issues
  if (queryLower.includes('like') && queryLower.includes('%')) {
    return 'Consider using full-text search (PostgreSQL tsvector) instead of LIKE with leading wildcard';
  }
  
  if (queryLower.includes('join') && durationMs > 500) {
    return 'Verify indexes on join columns and consider query optimization';
  }
  
  if (queryLower.includes('count(*)') && durationMs > 200) {
    return 'Consider using approximate count for large tables or caching result';
  }
  
  if (queryLower.includes('order by') && durationMs > 300) {
    return 'Ensure index exists on ORDER BY columns';
  }
  
  if (durationMs > 1000) {
    return 'Query exceeds 1 second - consider breaking into smaller queries or adding pagination';
  }
  
  return 'Review query execution plan with EXPLAIN ANALYZE';
}

/**
 * Get recent slow queries
 */
export function getRecentSlowQueries(limit: number = 10): SlowQueryLog[] {
  return recentSlowQueries.slice(-limit).reverse();
}

/**
 * Get query patterns sorted by frequency
 */
export function getQueryPatterns(sortBy: 'count' | 'avgDuration' | 'maxDuration' = 'count'): QueryPattern[] {
  const patterns = Array.from(queryPatterns.values());
  
  switch (sortBy) {
    case 'avgDuration':
      return patterns.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
    case 'maxDuration':
      return patterns.sort((a, b) => b.maxDurationMs - a.maxDurationMs);
    case 'count':
    default:
      return patterns.sort((a, b) => b.count - a.count);
  }
}

/**
 * Get currently running queries with performance details
 */
export async function getCurrentlyRunningQueries(): Promise<Array<{
  pid: number;
  duration_sec: number;
  query: string;
  state: string;
  wait_event?: string;
  application_name?: string;
}>> {
  const result = await db.execute(sql`
    SELECT 
      pid,
      EXTRACT(EPOCH FROM (NOW() - query_start)) as duration_sec,
      LEFT(query, 200) as query,
      state,
      wait_event,
      application_name
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state = 'active'
      AND query NOT LIKE '%pg_stat_activity%'
    ORDER BY query_start
  `);
  
  return result as any as Array<{
    pid: number;
    duration_sec: number;
    query: string;
    state: string;
    wait_event?: string;
    application_name?: string;
  }>;
}

/**
 * Get query performance statistics from PostgreSQL
 */
export async function getQueryPerformanceStats(): Promise<Array<{
  query: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  max_time_ms: number;
}>> {
  // Requires pg_stat_statements extension
  try {
    const result = await db.execute(sql`
      SELECT 
        LEFT(query, 200) as query,
        calls,
        total_exec_time as total_time_ms,
        mean_exec_time as mean_time_ms,
        max_exec_time as max_time_ms
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY mean_exec_time DESC
      LIMIT 20
    `);
    
    return result as any as Array<{
      query: string;
      calls: number;
      total_time_ms: number;
      mean_time_ms: number;
      max_time_ms: number;
    }>;
  } catch (error) {
    // pg_stat_statements not enabled
    logger.warn('pg_stat_statements extension not available', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Clear query pattern cache
 */
export function clearQueryPatterns(): void {
  queryPatterns.clear();
  logger.info('Query pattern cache cleared');
}

/**
 * Get query performance summary
 */
export interface QueryPerformanceSummary {
  totalQueries: number;
  slowQueries: number;
  avgDurationMs: number;
  maxDurationMs: number;
  topSlowPatterns: QueryPattern[];
  recentSlowQueries: SlowQueryLog[];
}

export function getQueryPerformanceSummary(): QueryPerformanceSummary {
  const patterns = Array.from(queryPatterns.values());
  const totalQueries = patterns.reduce((sum, p) => sum + p.count, 0);
  const avgDurationMs = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + p.avgDurationMs * p.count, 0) / totalQueries
    : 0;
  const maxDurationMs = patterns.length > 0
    ? Math.max(...patterns.map(p => p.maxDurationMs))
    : 0;
  
  return {
    totalQueries,
    slowQueries: recentSlowQueries.length,
    avgDurationMs,
    maxDurationMs,
    topSlowPatterns: getQueryPatterns('maxDuration').slice(0, 10),
    recentSlowQueries: getRecentSlowQueries(5)
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Wrap individual queries
 * const users = await withQueryMonitoring(
 *   'getUsersByRole',
 *   () => db.query.users.findMany({
 *     where: eq(users.role, 'ADMIN')
 *   })
 * );
 * 
 * // Get performance summary
 * const summary = getQueryPerformanceSummary();
 * logger.info(`Slow queries: ${summary.slowQueries}`);
 * logger.info(`Average duration: ${summary.avgDurationMs.toFixed(2)}ms`);
 * ```
 */
