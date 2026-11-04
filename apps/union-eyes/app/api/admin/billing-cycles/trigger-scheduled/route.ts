/**
 * Billing SchedulerManual Trigger API
 * 
 * POST /api/admin/billing-cycles/trigger-scheduled - Manually trigger scheduled billing
 * 
 * For testing and manual execution of the automated billing scheduler.
 *
 * TRUTHFUL STATUS (PR #752 round 5): this is currently the ONLY live
 * caller of BillingScheduler — there is no cron/timer trigger wired
 * anywhere (vercel.json's "crons" list does not include a billing path).
 * "Automated billing scheduler" describes what lib/jobs/billing-scheduler.ts
 * is DESIGNED to do once invoked; it does not mean billing runs on a
 * schedule today. Automated/headless invocation is also blocked by
 * BillingCycleService.generateBillingCycle()'s unconditional auth()
 * requirement (see billing-scheduler.ts's documented KNOWN LIMITATION) —
 * it would throw "Unauthorized" without a real session. Until a genuine
 * headless entrypoint and a real scheduled trigger both exist, treat
 * automated recurring billing as LATENT / NOT_OPERATIONAL, not a live
 * capability.
 * 
 * @module app/api/admin/billing-cycles/trigger-scheduled
 */

import { NextResponse } from 'next/server';
import { BillingScheduler } from '@/lib/jobs/billing-scheduler';
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution

const triggerSchema = z.object({
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
});

// Billing every organization is a platform operation, gated by platform authority, so it runs as the system role. That is not a tenant
// transaction, and the intent record the audit boundary writes first must commit on its own, so the wrapper opens none.
export const POST = withApi(
  {
    auth: { minRole: 'platform_lead' },
    openapi: { tags: ['Admin', 'Billing'], summary: 'Manually trigger scheduled billing for every organization' },
  },
  async ({ request, userId, organizationId }) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
    }
    const validation = triggerSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const { frequency } = validation.data;

    logger.info('Manually triggering scheduled billing', {
      frequency,
      userId,
    });

    // Execute scheduled billing
    // Billing every organization is a platform operation: the intent is recorded before it starts.
    const result = await performAuditedOperation(
      {
        organizationId,
        userId,
        scope: 'system',
        action: 'platform.billing_cycle.trigger_scheduled',
        resourceType: 'billing_scheduler',
        details: { frequency },
      },
      () => withSystemContext(() => BillingScheduler.manualTrigger(frequency)),
    );

    logger.info('Scheduled billing completed', {
      frequency,
      totalOrganizations: result.totalOrganizations,
      successful: result.successful,
      failed: result.failed,
      userId,
    });

    return standardSuccessResponse({
      ...result,
      message: `Scheduled billing executed for ${result.totalOrganizations} organizations. ${result.successful} successful, ${result.failed} failed.`,
    });
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    logger.error('Error triggering scheduled billing', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to trigger scheduled billing'
    );
  }
  },
);
