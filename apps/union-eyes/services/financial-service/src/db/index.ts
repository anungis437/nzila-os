import { config } from 'dotenv';
config(); // Load environment variables first

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
type LoggerType = {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
};

let logger: LoggerType | null = null;

function getLogger(): LoggerType {
  if (!logger) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable
    const module = require('../../../../lib/logger') as { logger: LoggerType };
    logger = module.logger;
  }
  return logger;
}

// Database connection configuration — lazily initialised so test files can
// load without throwing when DATABASE_URL is absent.

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getClient() {
  if (!_client) {
    const connectionString = process.env.DATABASE_URL || '';
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _client;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

/**
 * Lazy-initialised Drizzle database instance.
 * Throws on first access if DATABASE_URL is not set.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as any as Record<string | symbol, unknown>)[prop];
  },
});

// Export schema for use in queries
export { schema };

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await getClient()`SELECT 1`;
    return true;
  } catch (error) {
    getLogger().error('Database connection failed', { error });
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  if (_client) {
    await _client.end();
  }
}
