/**
 * API Route: POST /api/admin/jobs/[action]
 * 
 * Pause, resume, or clean job queues (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { withSystemAdminAuth } from "@/lib/api-auth-guard";
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const adminJobsSchema = z.object({
  queue: z.string().min(1, 'queue is required'),
  olderThanMs: z.unknown().optional(),
});

export const POST = async (request: NextRequest, { params: pendingParams }: { params: Promise<{ action: string }> }) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams;
  // The job queues are platform-wide: pausing one stops that work for every organization, so this needs platform
  // authority, not an organization administrator role.
  return withSystemAdminAuth(async (request, context) => {
  // Import job-queue functions (now delegates to Django Celery task API)
    const { pauseQueue, resumeQueue, cleanCompletedJobs } = await import('@/lib/job-queue');
    try {
      const { action } = params;
      const body = await request.json();
    // Validate request body
    const validation = adminJobsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { queue } = validation.data;

      if (!queue) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Queue name is required'
    );
      }

      if (!['pause', 'resume', 'clean'].includes(action)) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid action');
      }
      const cleanOlderThanMs = (body.olderThanMs as number) || 24 * 60 * 60 * 1000; // 24 hours default

      await performAuditedOperation(
        {
          organizationId: context.organizationId,
          userId: context.userId,
          action: `platform.job_queue.${action}`,
          resourceType: 'job_queue',
          resourceId: queue,
          details: action === 'clean' ? { olderThanMs: cleanOlderThanMs } : {},
        },
        async () => {
          if (action === 'pause') await pauseQueue(queue);
          else if (action === 'resume') await resumeQueue(queue);
          else await cleanCompletedJobs(queue, cleanOlderThanMs);
        },
      );
      const done = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cleaned';
      return NextResponse.json({ success: true, message: `Queue ${queue} ${done}` });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
    })(request, { params });
};
