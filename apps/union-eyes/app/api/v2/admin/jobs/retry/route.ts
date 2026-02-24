/**
 * POST /api/admin/jobs/retry
 * Migrated to withApi() framework
 */
import { retryJob } from '@/lib/job-queue';
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const adminJobsRetrySchema = z.object({
  queue: z.string().optional(),
  jobId: z.string().uuid('Invalid jobId'),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: adminJobsRetrySchema,
    openapi: {
      tags: ['Admin'],
      summary: 'POST retry',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          const { queue, jobId } = body;
          // Validate request body
        if (!queue || !jobId) {
            throw ApiError.internal('Queue and jobId are required'
        );
          }
          await retryJob(queue, jobId);
          return {};
  },
);
