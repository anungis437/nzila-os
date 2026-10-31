/**
 * GET POST /api/compliance/data-classification-policy
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over data_classification_policy, a table no route writes and nothing enforces (no employer data firewall exists). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Compliance'],
      summary: '/api/compliance/data-classification-policy (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/compliance/data-classification-policy is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
