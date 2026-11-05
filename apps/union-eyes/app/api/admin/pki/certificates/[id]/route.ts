/**
 * GET PATCH DELETE /api/admin/pki/certificates/:id
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over organization_members: GET
 * returned member roster rows under this name and every write was refused, so nothing it advertises was ever done. It answers
 * HTTP 501 rather than present a roster listing as that operation. The member roster is served by /api/members/[id].
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members'],
      summary: '/api/admin/pki/certificates/:id (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/admin/pki/certificates/:id is not implemented: it performed no operation of its own and returned the member roster instead.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
