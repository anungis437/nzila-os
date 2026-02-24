/**
 * API Route: POST /api/admin/jobs/[action]
 * 
 * Pause, resume, or clean job queues (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { withAdminAuth } from "@/lib/api-auth-guard";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const adminJobsSchema = z.object({
  queue: z.string().min(1, 'queue is required'),
  olderThanMs: z.unknown().optional(),
});

export const POST = async (request: NextRequest, { params }: { params: { action: string } }) => {
  return withAdminAuth(async (request, _context) => {
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

      switch (action) {
        case 'pause':
          await pauseQueue(queue);
          return NextResponse.json({ success: true, message: `Queue ${queue} paused` });

        case 'resume':
          await resumeQueue(queue);
          return NextResponse.json({ success: true, message: `Queue ${queue} resumed` });

        case 'clean':
          const cleanOlderThanMs = (body.olderThanMs as number) || 24 * 60 * 60 * 1000; // 24 hours default
          await cleanCompletedJobs(queue, cleanOlderThanMs);
          return NextResponse.json({ success: true, message: `Queue ${queue} cleaned` });

        default:
          return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid action'
    );
      }
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
    })(request, { params });
};
