/**
 * Database Client - Multi-Database Support
 * 
 * This module re-exports the unified database client from the multi-db abstraction layer.
 * It maintains backward compatibility while supporting PostgreSQL and Azure SQL Server.
 * 
 * For direct multi-db operations, import from '@/lib/database/multi-db-client'
 */

// Load environment variables first (especially for script execution)
import { config } from 'dotenv';
import { resolve } from 'path';
// Only load .env.local if not in production and DATABASE_URL is not already set
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  config({ path: resolve(process.cwd(), '.env.local') });
}

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabase as getUnifiedDatabase, checkDatabaseHealth } from "@/lib/database/multi-db-client";
import { logger } from "@/lib/logger";

// Legacy PostgreSQL client (for backward compatibility)
// Consider migrating to getUnifiedDatabase() for multi-database support

// Configure connection pool size based on environment
// CI/E2E environments: 5 connections (prevent exhaustion)
// Test environments: 1 connection (single-threaded)
// Development: 20 connections (default)
// Production: 50-100 connections (configurable via DB_POOL_MAX)
const maxConnections = (process.env.CI || process.env.PLAYWRIGHT_TEST_AUTH)
  ? 5
  : (process.env.NODE_ENV === "test" || process.env.VITEST)
  ? 1
  : parseInt(process.env.DB_POOL_MAX || '20');

// Configure timeouts based on environment
// CI/E2E: shorter idle timeout to release connections faster
const idleTimeout = (process.env.CI || process.env.PLAYWRIGHT_TEST_AUTH)
  ? 5  // 5 second idle timeout in CI to aggressively release connections
  : parseInt(process.env.DB_IDLE_TIMEOUT || '30');
const connectTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT || '10');
const queryTimeout = parseInt(process.env.DB_QUERY_TIMEOUT || '30000');

const connectionOptions = {
  max: maxConnections,         // Connection pool size (configurable)
  idle_timeout: idleTimeout,   // Idle timeout in seconds (default: 30s)
  connect_timeout: connectTimeout, // Connect timeout in seconds (default: 10s)
  prepare: false,              // Disable prepared statements
  keepalive: true,             // Keep connections alive
  debug: false,                // Disable debug logging in production
  connection: {
    application_name: "union-claims-app", // Identify app in database logs
    statement_timeout: queryTimeout,       // Query timeout in milliseconds (default: 30s)
  }
};

// Create a postgres client with optimized connection options
// This is used when DATABASE_TYPE is 'postgresql' or not set
// Lazy initialization: defer connection until first use so `next build`
// can statically analyze pages without a real DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL;

let _client: ReturnType<typeof postgres> | undefined;
let _db: PostgresJsDatabase<typeof schema> | undefined;

function getClient() {
  if (!_client) {
    if (!databaseUrl) {
      throw new Error('Missing required environment variable: DATABASE_URL');
    }
    _client = postgres(databaseUrl, connectionOptions);
  }
  return _client;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

export const client = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) { return (getClient() as unknown as Record<string | symbol, unknown>)[prop]; },
  apply(_target, thisArg, args) { return (getClient() as unknown as ((...a: unknown[]) => unknown)).apply(thisArg, args); },
});

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) { return (getDb() as unknown as Record<string | symbol, unknown>)[prop]; },
});

// Export unified database client (supports PostgreSQL and Azure SQL)
export const getDatabase = getUnifiedDatabase;

/**
 * Check database connection health
 * Uses unified health check that supports all database types
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean, message: string }> {
  const health = await checkDatabaseHealth();
  return {
    ok: health.ok,
    message: health.message
  };
}

/**
 * Function to check and log connection status
 * Supports both PostgreSQL and Azure SQL Server
 */
export async function logDatabaseConnectionStatus(): Promise<void> {
  try {
    const status = await checkDatabaseConnection();
    if (status.ok) {
      logger.info(status.message);
    } else {
      logger.error(status.message);
    }
  } catch (error) {
    logger.error("Failed to check database connection", { error });
  }
}

