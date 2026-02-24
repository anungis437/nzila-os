/**
 * POST /api/dues/calculate
 * Migrated to withApi() framework
 */
 
 
 
 
 
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const calculateDuesSchema = z.object({
  memberId: z.string().uuid('Invalid member ID format'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start must be in YYYY-MM-DD format'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end must be in YYYY-MM-DD format'),
  memberData: z.record(z.any()).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    body: calculateDuesSchema,
    rateLimit: RATE_LIMITS.FINANCIAL_READ,
    openapi: {
      tags: ['Dues'],
      summary: 'POST calculate',
    },
    successStatus: 201,
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const rawBody = await request.json();
        return rawBody;
  },
);
