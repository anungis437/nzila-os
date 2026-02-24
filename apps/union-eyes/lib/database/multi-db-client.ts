/**
 * Database Abstraction Layer - Multi-Database Support
 * 
 * Provides unified interface for Drizzle ORM supporting:
 * - PostgreSQL (Supabase)
 * - Azure SQL Server
 * - Local PostgreSQL
 */

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleMssql } from 'drizzle-orm/node-postgres';
import postgres from 'postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import { eq, and, or, sql, inArray, isNull, desc, asc, ilike, gte, lte } from 'drizzle-orm';
import { safeColumnName } from '@/lib/safe-sql-identifiers';

// Database types
export type DatabaseType = 'postgresql' | 'azure-sql' | 'mssql';

// Database configuration
interface DatabaseConfig {
  type: DatabaseType;
  connectionString: string;
  options?: {
    max?: number;
    idleTimeout?: number;
    connectionTimeout?: number;
    ssl?: boolean;
  };
}

// Unified database client interface
export interface UnifiedDatabaseClient {
  query: unknown;
  insert: unknown;
  update: unknown;
  delete: unknown;
  select: unknown;
  transaction: unknown;
  execute: unknown;
}

/**
 * Get database configuration from environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DATABASE_TYPE || 'postgresql') as DatabaseType;
  const connectionString = process.env.DATABASE_URL || process.env.AZURE_SQL_CONNECTION_STRING || '';

  // Environment-aware defaults:
  // - Test: max 1 connection
  // - Development: max 20 connections
  // - Production: max 50+ connections (configurable)
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;
  const defaultMaxConnections = isTest ? 1 : 20;

  return {
    type: dbType,
    connectionString,
    options: {
      max: parseInt(process.env.DB_POOL_MAX || String(defaultMaxConnections)),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10'),
      ssl: process.env.DB_SSL === 'true',
    },
  };
}

/**
 * Create database client based on configuration
 */
export async function createDatabaseClient(config?: DatabaseConfig): Promise<UnifiedDatabaseClient> {
  const dbConfig = config || getDatabaseConfig();

  switch (dbConfig.type) {
    case 'azure-sql':
    case 'mssql':
      return createAzureSqlClient(dbConfig);
    case 'postgresql':
    default:
      return createPostgresClient(dbConfig);
  }
}

/**
 * Create PostgreSQL client (Supabase compatible)
 */
function createPostgresClient(config: DatabaseConfig): UnifiedDatabaseClient {
  const client = postgres(config.connectionString, {
    max: config.options?.max || 10,
    idle_timeout: config.options?.idleTimeout || 30,
    connect_timeout: config.options?.connectionTimeout || 10,
    prepare: false,
  });

  return drizzlePg(client, { schema }) as UnifiedDatabaseClient;
}

/**
 * Create Azure SQL / MSSQL client
 */
function createAzureSqlClient(config: DatabaseConfig): UnifiedDatabaseClient {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.options?.max || 10,
    idleTimeoutMillis: (config.options?.idleTimeout || 30) * 1000,
    connectionTimeoutMillis: (config.options?.connectionTimeout || 10) * 1000,
    ssl: config.options?.ssl ? { rejectUnauthorized: false } : undefined,
  });

  return drizzleMssql(pool, { schema }) as UnifiedDatabaseClient;
}

/**
 * Execute query with database abstraction
 * Handles differences between PostgreSQL and Azure SQL syntax
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeQuery<T = any>(
  db: UnifiedDatabaseClient,
  queryFn: (db: UnifiedDatabaseClient) => Promise<T>
): Promise<T> {
  try {
    return await queryFn(db);
  } catch (error) {
throw error;
  }
}

/**
 * Handle full-text search differences between databases
 * SECURITY: Column names are validated and safely escaped using safeColumnName()
 */
export function createFullTextSearchQuery(
  searchTerm: string,
  columns: string[],
  dbType: DatabaseType = 'postgresql'
) {
  // Strip any characters that could break out of a search term context
  const sanitizedTerm = searchTerm.replace(/[-'"\\;]/g, '').trim();
  if (!sanitizedTerm) {
    return sql`FALSE`;
  }
  
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL CONTAINS: use parameterized value wrapped in double-quotes
    // CONTAINS requires the search term inside the SQL string, but we sanitize it strictly
    const searchConditions = columns.map(col => {
      const safeCol = safeColumnName(col);
      return sql`CONTAINS(${safeCol}, ${`"${sanitizedTerm}"`})`;
    });
    return sql.join(searchConditions, sql.raw(' OR '));
  } else {
    // PostgreSQL: plainto_tsquery safely handles parameterized input
    const searchConditions = columns.map(col => {
      const safeCol = safeColumnName(col);
      return sql`to_tsvector('english', ${safeCol}) @@ plainto_tsquery('english', ${sanitizedTerm})`;
    });
    return sql.join(searchConditions, sql.raw(' OR '));
  }
}

/**
 * Handle date/time functions differences
 */
export function getCurrentTimestamp(dbType: DatabaseType = 'postgresql') {
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    return sql`GETUTCDATE()`;
  } else {
    return sql`NOW()`;
  }
}

/**
 * Handle array operations differences
 * SECURITY: Column name is validated and safely escaped using safeColumnName()
 */
export function arrayAppend(
  column: string,
  value: string,
  dbType: DatabaseType = 'postgresql'
) {
  // SECURITY: Validate and escape column name to prevent SQL injection
  const safeCol = safeColumnName(column);
  
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL doesn&apos;t have native array type, use JSON
    return sql`JSON_MODIFY(${safeCol}, 'append $', ${value})`;
  } else {
    // PostgreSQL array_append
    return sql`array_append(${safeCol}, ${value})`;
  }
}

/**
 * Handle ILIKE vs LIKE differences
 */
export function createLikeQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any,
  pattern: string,
  dbType: DatabaseType = 'postgresql'
) {
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL LIKE is case-insensitive by default with proper collation
    return sql`${column} LIKE ${pattern}`;
  } else {
    // PostgreSQL ILIKE for case-insensitive
    return ilike(column, pattern);
  }
}

/**
 * Handle JSON operations differences
 * SECURITY: Column name validated with safeColumnName(), path escaped for safe interpolation
 */
export function jsonExtract(
  column: string,
  path: string,
  dbType: DatabaseType = 'postgresql'
) {
  // SECURITY: Validate and escape column name to prevent SQL injection
  const safeCol = safeColumnName(column);
  
  // SECURITY: Escape path string (JSON paths use $ and . notation, validate format)
  // Allowed characters: $, ., [, ], alphanumeric, underscore
  if (!/^\$[.\[\]a-zA-Z0-9_]*$/.test(path)) {
    throw new Error(`Invalid JSON path format: "${path}". Must start with $ and contain only ., [, ], alphanumeric, or underscore.`);
  }
  
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL JSON_VALUE - path is parameterized as string literal
    return sql`JSON_VALUE(${safeCol}, ${path})`;
  } else {
    // PostgreSQL JSONB operator - path is safe string literal
    // Extract the key after the $ prefix (e.g., "$.key" -> "key")
    const pathKey = path.substring(1).replace(/^\./,  '');
    return sql`${safeCol}::jsonb->>${pathKey}`;
  }
}

/**
 * Handle UUID generation differences
 */
export function generateUuid(dbType: DatabaseType = 'postgresql') {
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    return sql`NEWID()`;
  } else {
    return sql`gen_random_uuid()`;
  }
}

/**
 * Handle pagination differences (LIMIT/OFFSET vs TOP/OFFSET)
 */
export function createPaginationQuery(
  limit: number,
  offset: number,
  dbType: DatabaseType = 'postgresql'
) {
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL uses OFFSET...FETCH NEXT
    return {
      offset: sql`OFFSET ${offset} ROWS`,
      limit: sql`FETCH NEXT ${limit} ROWS ONLY`,
    };
  } else {
    // PostgreSQL uses LIMIT/OFFSET
    return {
      offset: sql`OFFSET ${offset}`,
      limit: sql`LIMIT ${limit}`,
    };
  }
}

/**
 * Handle boolean type differences
 */
export function createBooleanQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any,
  value: boolean,
  dbType: DatabaseType = 'postgresql'
) {
  if (dbType === 'azure-sql' || dbType === 'mssql') {
    // Azure SQL uses BIT (0/1)
    return eq(column, value ? 1 : 0);
  } else {
    // PostgreSQL uses BOOLEAN
    return eq(column, value);
  }
}

/**
 * Handle NULL checks differences
 */
export function createNullCheck(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any,
  checkNull: boolean = true,
  dbType: DatabaseType = 'postgresql'
) {
  if (checkNull) {
    return isNull(column);
  } else {
    if (dbType === 'azure-sql' || dbType === 'mssql') {
      return sql`${column} IS NOT NULL`;
    } else {
      return sql`${column} IS NOT NULL`;
    }
  }
}

/**
 * Export common Drizzle operators
 */
export { eq, and, or, sql, inArray, isNull, desc, asc, ilike, gte, lte };

/**
 * Singleton database instance
 */
let dbInstance: UnifiedDatabaseClient | null = null;

export async function getDatabase(): Promise<UnifiedDatabaseClient> {
  if (!dbInstance) {
    dbInstance = await createDatabaseClient();
  }
  return dbInstance;
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  message: string;
  type: DatabaseType;
}> {
  const config = getDatabaseConfig();
  
  try {
    const db = await getDatabase();
    const startTime = Date.now();
    
    // Simple health check query
    await executeQuery(db, async (db) => {
      if (config.type === 'azure-sql' || config.type === 'mssql') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (db as any).execute(sql`SELECT 1`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (db as any).execute(sql`SELECT 1`);
      }
    });
    
    const duration = Date.now() - startTime;
    
    return {
      ok: true,
      message: `Database connection successful (${duration}ms)`,
      type: config.type,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      type: config.type,
    };
  }
}

