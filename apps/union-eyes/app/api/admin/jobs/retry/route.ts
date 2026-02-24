/**
 * API Route: POST /api/admin/jobs/retry
 * 
 * Retry a failed job (admin only)
 */

import { NextResponse } from 'next/server';
import { z } from "zod";
import { withAdminAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const adminJobsRetrySchema = z.object({
  queue: z.string().optional(),
  jobId: z.string().uuid('Invalid jobId'),
});

export const POST = withAdminAuth(async (request, _context) => {
  // Import job-queue functions (now delegates to Django Celery task API)
    const { retryJob } = await import('@/lib/job-queue');
    try {
      const body = await request.json();
    // Validate request body
    const validation = adminJobsRetrySchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { queue, jobId } = validation.data;

      if (!queue || !jobId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Queue and jobId are required'
    );
      }

      await retryJob(queue, jobId);

      return NextResponse.json({ success: true });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

