/**
 * Database Health Check & Validation
 * 
 * Provides utilities to validate database connection and health at startup.
 * Use this to ensure database is accessible before serving traffic.
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';
export interface DatabaseHealthStatus {
  healthy: boolean;
  responseTime: number;
  error?: string;
  details?: {
    connected: boolean;
    version?: string;
    database?: string;
    poolStatus?: PoolStatus;
  };
}

export interface PoolStatus {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
}

/**
 * Check database connection health
 * Performs a simple query to validate connectivity
 * 
 * @param timeout - Max time to wait for response in ms (default: 5000)
 * @returns Promise<DatabaseHealthStatus>
 */
export async function checkDatabaseHealth(timeout = 5000): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Race between health check and timeout
    const result = await Promise.race([
      performHealthCheck(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      ),
    ]);
    
    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      details: result as DatabaseHealthStatus['details'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: errorMessage,
      details: {
        connected: false,
      },
    };
  }
}

/**
 * Internal health check logic
 */
async function performHealthCheck() {
  try {
    // Simple query to test connection
    const result: unknown = await db.execute(sql`
      SELECT 
        version() as version,
        current_database() as database,
        current_user as user,
        NOW() as timestamp
    `);
    
    // Handle both array and rows format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    const row = rows[0];
    
    return {
      connected: true,
      version: row?.version,
      database: row?.database,
      timestamp: row?.timestamp,
    };
  } catch (error) {
    logger.error('Database health check connection test failed', error);
    throw error;
  }
}

/**
 * Validate database connection with retry logic
 * Useful for startup checks with connection retries
 * 
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 2000)
 * @returns Promise<boolean> - true if connection successful
 */
export async function validateDatabaseConnection(
  maxRetries = 3,
  retryDelay = 2000
): Promise<boolean> {
  logger.info('Starting database connection validation');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info('Database validation attempt', { attempt, maxRetries });
    
    const health = await checkDatabaseHealth();
    
    if (health.healthy) {
      logger.info('Database connection validated', { 
        responseTime: health.responseTime,
        hasDetails: !!health.details 
      });
      return true;
    }
    
    logger.error('Database health check failed', undefined, { 
      attempt, 
      error: health.error 
    });
    
    if (attempt < maxRetries) {
      logger.info('Retrying database connection', { retryDelay });
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  logger.error('Database validation failed after all retry attempts');
  return false;
}

/**
 * Test query execution to validate schema
 * Runs a simple SELECT to ensure tables are accessible
 */
export async function testDatabaseQuery(): Promise<boolean> {
  try {
    // Test basic query (assumes users table exists)
    const result: unknown = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Handle both array and rows format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    const count = rows[0]?.count;
    logger.info('Database query test passed', { tableCount: count });
    return true;
  } catch (error) {
    logger.error('Database query test failed', error);
    return false;
  }
}

/**
 * Validate database migrations are up to date
 * Checks if all expected tables exist
 */
export async function validateDatabaseSchema(): Promise<{
  valid: boolean;
  missingTables: string[];
  tableCount: number;
}> {
  try {
    // Get list of tables in public schema
    const result: unknown = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Handle both array and rows format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tables = rows.map((row: any) => row.table_name);
    const tableCount = tables.length;
    
    // Check for critical tables
    const criticalTables = [
      'users',
      'organizations',
      'profiles',
      'claims',
    ];
    
    const missingTables = criticalTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      logger.warn('Missing critical database tables', { 
        missingTables,
        message: 'Database migrations may not be up to date' 
      });
    } else {
      logger.info('Database schema validation passed', { tableCount });
    }
    
    return {
      valid: missingTables.length === 0,
      missingTables,
      tableCount,
    };
  } catch (error) {
    logger.error('Database schema validation failed', error);
    return {
      valid: false,
      missingTables: [],
      tableCount: 0,
    };
  }
}

/**
 * Run full database startup validation
 * Performs connection check, query test, and schema validation
 * 
 * @param throwOnError - Whether to throw error if validation fails
 * @returns Promise with isHealthy flag and any error messages
 */
export async function runDatabaseStartupChecks(throwOnError = false): Promise<{ isHealthy: boolean; errors: string[] }> {
  logger.info('Running database startup validation');
  const errors: string[] = [];
  
  // 1. Validate connection with retries
  const connectionValid = await validateDatabaseConnection(3, 2000);
  if (!connectionValid) {
    const msg = 'Database connection validation failed';
    errors.push(msg);
    if (throwOnError) throw new Error(msg);
    return { isHealthy: false, errors };
  }
  
  // 2. Test query execution
  const queryValid = await testDatabaseQuery();
  if (!queryValid) {
    const msg = 'Database query test failed';
    errors.push(msg);
    if (throwOnError) throw new Error(msg);
    return { isHealthy: false, errors };
  }
  
  // 3. Validate schema
  const schemaResult = await validateDatabaseSchema();
  if (!schemaResult.valid) {
    logger.warn('Database schema validation warnings detected');
    // Don't fail on schema warnings, just log them
  }
  
  logger.info('All database startup checks passed');
  return { isHealthy: true, errors };
}

/**
 * Health check endpoint handler
 * Use this for /health or /api/health routes
 */
export async function getDatabaseHealthForEndpoint(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    responseTime: number;
    error?: string;
  };
}> {
  const health = await checkDatabaseHealth(3000);
  
  return {
    status: health.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: health.healthy,
      responseTime: health.responseTime,
      error: health.error,
    },
  };
}

