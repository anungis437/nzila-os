/**
 * GET PATCH DELETE /api/communications/templates/:id/duplicate
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over message templates (a template item; nothing is duplicated and its DELETE removed the template). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Communications'],
      summary: '/api/communications/templates/:id/duplicate (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/communications/templates/:id/duplicate is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
