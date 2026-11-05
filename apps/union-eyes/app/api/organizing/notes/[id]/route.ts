/**
 * GET PATCH DELETE /api/organizing/notes/:id
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over organizing_campaigns (no note is stored). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Organization'],
      summary: '/api/organizing/notes/:id (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/organizing/notes/:id is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
