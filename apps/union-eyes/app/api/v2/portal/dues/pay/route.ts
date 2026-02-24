/**
 * GET POST /api/portal/dues/pay
 * Migrated to withApi() framework
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auth } from '@clerk/nextjs/server';
import { withApi, z } from '@/lib/api/framework';

const _paymentSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum([
    'stripe',
    'bank_transfer',
    'check',
    'cash',
    'direct_debit',
    'payroll_deduction',
    'ewallet',
  ]),
  paymentReference: z.string().optional(),
  description: z.string().optional(),
});

 
 
import { GET as v1GET, POST as v1POST } from '@/app/api/portal/dues/pay/route';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Portal'],
      summary: 'GET pay',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Portal'],
      summary: 'POST pay',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);
