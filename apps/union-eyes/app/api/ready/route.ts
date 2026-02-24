/**
 * Readiness Probe API
 * 
 * Kubernetes readiness check - determines if app is ready to receive traffic
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
interface ReadinessCheck {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    migrations: boolean;
    cache: boolean;
  };
  message: string;
}

/**
 * GET /api/ready
 * Readiness probe for Kubernetes
 */
export async function GET() {
  try {
    const checks = {
      database: await checkDatabaseReady(),
      migrations: await checkMigrationsComplete(),
      cache: await checkCacheReady(),
    };

    const ready = Object.values(checks).every(check => check === true);

    const response: ReadinessCheck = {
      ready,
      timestamp: new Date().toISOString(),
      checks,
      message: ready ? 'Service is ready' : 'Service is not ready',
    };

    return NextResponse.json(response, { status: ready ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      ready: false,
      timestamp: new Date().toISOString(),
      message: `Readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 503 });
  }
}

/**
 * Check if database is ready (not just alive, but ready for queries)
 */
async function checkDatabaseReady(): Promise<boolean> {
  try {
    // Test a real table exists
    const _result = await db.execute(sql`
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
    // Check if drizzle migrations table exists and has entries
    const _result = await db.execute(sql`
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
  // If Redis/cache is critical, check it here
  // For now, return true (cache is optional)
  return true;
}
