/**
 * POST /api/admin/jobs/[action]
 * Migrated to withApi() framework
 */
import { pauseQueue, resumeQueue, cleanCompletedJobs } from '@/lib/job-queue';
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const adminJobsSchema = z.object({
  queue: z.string().min(1, 'queue is required'),
  olderThanMs: z.unknown().optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: adminJobsSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'POST [action]',
    },
    successStatus: 201,
  },
  async ({ request: _request, params, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          const { action } = params;
          const { queue } = body;
          // Validate request body
        if (!queue) {
            throw ApiError.internal('Queue name is required'
        );
          }
          switch (action) {
            case 'pause':
              await pauseQueue(queue);
              return { message: `Queue ${queue} paused` };
            case 'resume':
              await resumeQueue(queue);
              return { message: `Queue ${queue} resumed` };
            case 'clean':
              const cleanOlderThanMs = (body.olderThanMs as number) || 24 * 60 * 60 * 1000; // 24 hours default
              await cleanCompletedJobs(queue, cleanOlderThanMs);
              return { message: `Queue ${queue} cleaned` };
            default:
              throw ApiError.badRequest('Invalid action'
        );
          }
  },
);
