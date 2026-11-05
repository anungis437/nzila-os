/**
 * GET POST /api/education/notification-preferences
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over training_courses (course rows; no preference is stored). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Scheduling'],
      summary: '/api/education/notification-preferences (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/education/notification-preferences is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
