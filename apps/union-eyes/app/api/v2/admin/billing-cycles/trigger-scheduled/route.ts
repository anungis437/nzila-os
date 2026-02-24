/**
 * POST /api/admin/billing-cycles/trigger-scheduled
 * Migrated to withApi() framework
 */
import { BillingScheduler } from '@/lib/jobs/billing-scheduler';
import { logger } from '@/lib/logger';

 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const triggerSchema = z.object({
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
});

export const POST = withApi(
  {
    auth: { required: true },
    body: triggerSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'POST trigger-scheduled',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user, body, query: _query }) => {

        if (!user) {
          throw ApiError.unauthorized('Authentication required');
        }
        const { frequency } = body;
        // Require admin role (you can adjust this based on your RBAC)
        // if (user.role !== 'admin') {
        //   return standardErrorResponse(
        //     ErrorCode.FORBIDDEN,
        //     'Admin role required to trigger scheduled billing'
        //   );
        // }
        logger.info('Manually triggering scheduled billing', {
          frequency,
          userId: user.id,
        });
        // Execute scheduled billing
        const result = await BillingScheduler.manualTrigger(frequency);
        logger.info('Scheduled billing completed', {
          frequency,
          totalOrganizations: result.totalOrganizations,
          successful: result.successful,
          failed: result.failed,
          userId: user.id,
        });
        return {
          ...result,
          message: `Scheduled billing executed for ${result.totalOrganizations} organizations. ${result.successful} successful, ${result.failed} failed.`,
        };
  },
);
