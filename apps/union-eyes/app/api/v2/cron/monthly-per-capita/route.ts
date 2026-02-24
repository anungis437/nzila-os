/**
 * GET POST /api/cron/monthly-per-capita
 * Migrated to withApi() framework
 */
import { processMonthlyPerCapita } from '@/services/clc/per-capita-calculator';
import { timingSafeEqual } from 'crypto';
 
 
import { markOverdueRemittances } from '@/services/clc/per-capita-calculator';

 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron'],
      summary: 'GET monthly-per-capita',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        // Verify this is a cron request (timing-safe comparison)
        const authHeader = request.headers.get('authorization');
        const secret = authHeader?.replace('Bearer ', '') ?? '';
        const expected = process.env.CRON_SECRET ?? '';
        const secretBuf = Buffer.from(secret);
        const expectedBuf = Buffer.from(expected);
        if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
    // Run monthly calculation
        const result = await processMonthlyPerCapita();
        // Mark overdue remittances
        const overdueCount = await markOverdueRemittances();
    return { timestamp: new Date().toISOString(),
          calculation: result,
          overdueMarked: overdueCount, };
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron'],
      summary: 'POST monthly-per-capita',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);
