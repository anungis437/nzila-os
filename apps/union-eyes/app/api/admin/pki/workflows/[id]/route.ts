/**
 * GET PUT DELETE /api/admin/pki/workflows/[id]
 *
 * Not implemented. The signing workflows these handlers read, advanced by hand (already refused) and cancelled were held in a process-local map
 * that nothing populates, so every call answered "Workflow not found" and no workflow could exist. They answer HTTP 501 rather than present
 * an empty store as a signing workflow service.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Signatures'],
      summary: '/api/admin/pki/workflows/[id] (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/admin/pki/workflows/[id] is not implemented: its workflows were held in a process-local map that nothing populates, so none could exist.');
  },
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
