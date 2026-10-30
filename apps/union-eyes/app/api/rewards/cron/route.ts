/**
 * Cron Job for Rewards Automation
 * Runs scheduled tasks for automated awards, expiration warnings, etc.
 * 
 * This should be triggered by:
 * - the scheduled job declared in lib/operations/scheduled-jobs.json (POST, x-cron-secret)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cronSecretMatches } from '@/lib/api/cron-secret';
import { jobResponse, type JobFailure } from '@/lib/operations/job-result';
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
 * 
 * Security: the cron secret (CRON_SECRET_KEY or CRON_SECRET), presented as x-cron-secret or a bearer token
 */
const TASKS = ['anniversaries', 'expirations', 'scheduled', 'all'] as const;

/** An organization task fails when it rejects, and also when it resolves with its own success flag false (it reports rather than throws). */
function organizationFailure(task: string, organizationId: string, result: PromiseSettledResult<unknown>): JobFailure | null {
  if (result.status === 'rejected') return { scope: `${task}:${organizationId}`, reason: 'organization task rejected' };
  if ((result.value as { success?: boolean } | undefined)?.success === false) return { scope: `${task}:${organizationId}`, reason: 'organization task reported failure' };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the cron secret with the rule shared with the edge check and withApi (lib/api/cron-secret.ts):
    // x-cron-secret or a bearer token, CRON_SECRET_KEY then CRON_SECRET, constant time, unset never matches.
    if (!(await cronSecretMatches(request.headers))) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
    }

    // 2. Get task parameter
    const searchParams = request.nextUrl.searchParams;
    const task = searchParams.get('task') || 'all';
    // An unknown task executes nothing, so it is refused instead of answering success for work that never ran.
    if (!TASKS.includes(task as (typeof TASKS)[number])) {
      return NextResponse.json({ success: false, error: 'UNKNOWN_TASK', allowed: TASKS }, { status: 400 });
    }
    const failures: JobFailure[] = [];
    let succeeded = 0;

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
      
      anniversaryResults.forEach((r, i) => {
        const failure = organizationFailure('anniversaries', organizations[i].id, r);
        if (failure) failures.push(failure);
        else succeeded += 1;
      });
      results.executed.push({
        task: 'anniversaries',
        organizations: organizations.length,
        results: anniversaryResults.map((r, i) => ({
          orgId: organizations[i].id,
          status: r.status,
          data: r.status === 'fulfilled' ? r.value : undefined,
          error: r.status === 'rejected' ? String(r.reason instanceof Error ? r.reason.message : r.reason) : undefined,
        })),
      });
    }

    if (task === 'expirations' || task === 'all') {
const expirationResult = await sendBatchExpirationWarnings();
      // The batch carries its own success flag; wrapping it in a successful run would hide a failed one.
      if ((expirationResult as { success?: boolean } | undefined)?.success === false) failures.push({ scope: 'expirations', reason: 'expiration warnings reported failure' });
      else succeeded += 1;
      results.executed.push({
        task: 'expirations',
        result: expirationResult,
      });
    }

    if (task === 'scheduled' || task === 'all') {
const scheduledResults = await Promise.allSettled(
        organizations.map((org) => processScheduledAwards(org.id))
      );
      
      scheduledResults.forEach((r, i) => {
        const failure = organizationFailure('scheduled', organizations[i].id, r);
        if (failure) failures.push(failure);
        else succeeded += 1;
      });
      results.executed.push({
        task: 'scheduled',
        organizations: organizations.length,
        results: scheduledResults.map((r, i) => ({
          orgId: organizations[i].id,
          status: r.status,
          data: r.status === 'fulfilled' ? r.value : undefined,
          error: r.status === 'rejected' ? String(r.reason instanceof Error ? r.reason.message : r.reason) : undefined,
        })),
      });
    }
// 200 only when nothing failed; any rejected organization task makes the run 500 with the failing scopes in the body.
    return jobResponse({
      job: 'rewards-cron',
      attempted: succeeded + failures.length,
      succeeded,
      failures,
      details: { data: results },
    });
  } catch (_error: any) {
    return NextResponse.json(
      { error: 'Failed to execute scheduled tasks' },
      { status: 500 }
    );
  }
}
