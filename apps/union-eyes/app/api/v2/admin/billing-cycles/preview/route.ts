/**
 * POST /api/admin/billing-cycles/preview
 * Migrated to withApi() framework
 */
import { BillingCycleService } from '@/lib/services/billing-cycle-service';
import { logger } from '@/lib/logger';

 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const previewSchema = z.object({
  organizationId: z.string().uuid(),
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export const POST = withApi(
  {
    auth: { required: true },
    body: previewSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'POST preview',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId, user, body, query: _query }) => {
        const { periodStart, periodEnd, frequency } = body;

        if (!user || !organizationId) {
          throw ApiError.unauthorized('Authentication required'
          );
        }
        // Calculate period dates if not provided
        let start: Date;
        let end: Date;
        if (periodStart && periodEnd) {
          start = new Date(periodStart);
          end = new Date(periodEnd);
        } else {
          const dates = BillingCycleService.calculatePeriodDates(frequency);
          start = dates.periodStart;
          end = dates.periodEnd;
        }
        logger.info('Previewing billing cycle', {
          organizationId,
          frequency,
          periodStart: start,
          periodEnd: end,
          userId: user.id,
        });
        // Generate preview (dry run)
        const result = await BillingCycleService.generateBillingCycle({
          organizationId,
          periodStart: start,
          periodEnd: end,
          frequency,
          dryRun: true, // Always dry run for preview
          executedBy: user.id,
        });
        return {
          preview: true,
          ...result,
          message: `Preview: Would create ${result.transactionsCreated} transactions totaling $${result.totalAmount}`,
        };
  },
);
