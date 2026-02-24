/**
 * POST /api/admin/payments/retry-failed
 * Migrated to withApi() framework
 */
import { manualTriggerRetry } from '@/lib/jobs/failed-payment-retry';
import { logger } from '@/lib/logger';

 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Admin'],
      summary: 'POST retry-failed',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        if (!user) {
          throw ApiError.unauthorized('Authentication required'
          );
        }
        logger.info('Manually triggering failed payment retry', {
          userId: user.id,
        });
        // Execute failed payment retry job
        const result = await manualTriggerRetry();
        logger.info('Failed payment retry completed', {
          totalProcessed: result.totalProcessed,
          retriesAttempted: result.retriesAttempted,
          retriesSucceeded: result.retriesSucceeded,
          retriesFailed: result.retriesFailed,
          markedForAdmin: result.markedForAdmin,
          userId: user.id,
        });
        return {
          ...result,
          message: `Processed ${result.totalProcessed} transactions. ${result.retriesAttempted} retries attempted, ${result.retriesSucceeded} succeeded, ${result.markedForAdmin} marked for admin intervention.`,
        };
  },
);
