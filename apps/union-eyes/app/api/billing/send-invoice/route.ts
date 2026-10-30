/**
 * POST /api/billing/send-invoice
 *
 * Not implemented. This path advertises an operation of its own but was a route named for sending an invoice that generated one and delivered nothing (generation is POST /api/finance/invoices; delivery is not implemented). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Billing'],
      summary: '/api/billing/send-invoice (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/billing/send-invoice is not implemented: it performed no operation of its own.');
  },
);

export const POST = handler;
