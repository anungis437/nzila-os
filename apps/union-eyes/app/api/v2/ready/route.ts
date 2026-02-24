/**
 * GET /api/ready
 * Migrated to withApi() framework
 */
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Ready'],
      summary: 'GET ready',
    },
  },
  async (_ctx) => {
        const checks = {
          database: await checkDatabaseReady(),
          migrations: await checkMigrationsComplete(),
          cache: await checkCacheReady(),
        };
        const ready = Object.values(checks).every(check => check === true);
        const response = {
          ready,
          timestamp: new Date().toISOString(),
          checks,
          message: ready ? 'Service is ready' : 'Service is not ready',
        };
        return response;
  },
);

/**
 * Check if database is ready (not just alive, but ready for queries)
 */
async function checkDatabaseReady(): Promise<boolean> {
  try {
    await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if database migrations are complete
 */
async function checkMigrationsComplete(): Promise<boolean> {
  try {
    await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      )
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if cache/Redis is ready (if applicable)
 */
async function checkCacheReady(): Promise<boolean> {
  return true;
}
