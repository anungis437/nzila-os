/**
 * GET POST /api/ml/predictions/churn-risk
 *
 * Not implemented. This path advertises an operation of its own but was a score from a randomly initialised network pre-trained on generated examples and presented as a trained churn model. It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/ml/predictions/churn-risk (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/ml/predictions/churn-risk is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
