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

// Database connection configuration
const connectionString = process.env.DATABASE_URL || '';

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client
const client = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in queries
export { schema };

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    getLogger().error('Database connection failed', { error });
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
}
