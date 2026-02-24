/**
 * Cron Job for Rewards Automation
 * Runs scheduled tasks for automated awards, expiration warnings, etc.
 * 
 * This should be triggered by:
 * - Vercel Cron Jobs (vercel.json)
 * - External cron service (cron-job.org, etc.)
 * - Self-hosted cron daemon
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/db';
import { processAnniversaryAwards, processScheduledAwards } from '@/lib/services/rewards/automation-service';
import { sendBatchExpirationWarnings } from '@/lib/services/rewards/notification-service';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * POST /api/rewards/cron
 * 
 * Run scheduled reward system tasks
 * 
 * Query Parameters:
 * - task: 'anniversaries' | 'expirations' | 'scheduled' | 'all'
 * - secret: Verification token to prevent unauthorized execution
 * 
 * Security: Requires CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret (timing-safe comparison)
    const authHeader = request.headers.get('authorization');
    const secret = authHeader?.replace('Bearer ', '') ?? '';
    const expected = process.env.CRON_SECRET ?? '';
    const secretBuf = Buffer.from(secret);
    const expectedBuf = Buffer.from(expected);

    if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }

    // 2. Get task parameter
    const searchParams = request.nextUrl.searchParams;
    const task = searchParams.get('task') || 'all';

    const results: { timestamp: string; task: string; executed: Array<Record<string, unknown>> } = {
      timestamp: new Date().toISOString(),
      task,
      executed: [],
    };

    // 3. Get all organizations
    const organizations = await db.query.organizations.findMany({
      where: (orgs, { eq }) => eq(orgs.status, 'active'),
    });

    // 4. Process tasks
    if (task === 'anniversaries' || task === 'all') {
const anniversaryResults = await Promise.allSettled(
        organizations.map((org) => processAnniversaryAwards(org.id))
      );
      
      results.executed.push({
        task: 'anniversaries',
        organizations: organizations.length,
        results: anniversaryResults.map((r, i) => ({
          orgId: organizations[i].id,
          status: r.status,
          data: r.status === 'fulfilled' ? r.value : undefined,
          error: r.status === 'rejected' ? r.reason : undefined,
        })),
      });
    }

    if (task === 'expirations' || task === 'all') {
const expirationResult = await sendBatchExpirationWarnings();
      
      results.executed.push({
        task: 'expirations',
        result: expirationResult,
      });
    }

    if (task === 'scheduled' || task === 'all') {
const scheduledResults = await Promise.allSettled(
        organizations.map((org) => processScheduledAwards(org.id))
      );
      
      results.executed.push({
        task: 'scheduled',
        organizations: organizations.length,
        results: scheduledResults.map((r, i) => ({
          orgId: organizations[i].id,
          status: r.status,
          data: r.status === 'fulfilled' ? r.value : undefined,
          error: r.status === 'rejected' ? r.reason : undefined,
        })),
      });
    }
return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute scheduled tasks' },
      { status: 500 }
    );
  }
}

/**
 * GET handler - health check
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'rewards-cron',
    timestamp: new Date().toISOString(),
  });
}

