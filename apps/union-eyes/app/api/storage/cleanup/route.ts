/**
 * GET POST /api/storage/cleanup
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over cms_media_library (media rows; nothing is cleaned up). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Content'],
      summary: '/api/storage/cleanup (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/storage/cleanup is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
