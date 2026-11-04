/**
 * POST /api/admin/pki/signatures/[id]/sign
 *
 * Not implemented. The route signed a document into a signing workflow held in a process-local map that nothing creates (the collection route
 * that would open one is itself not implemented), so every call answered "Workflow not found" and no signature could ever be recorded. Its
 * service wrote an attestation, not a cryptographic signature, to a table no other code reads. It answers HTTP 501 rather than present
 * itself as a signing capability.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Signatures'],
      summary: '/api/admin/pki/signatures/[id]/sign (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/admin/pki/signatures/[id]/sign is not implemented: it signed into a process-local workflow that nothing creates, so it could never record a signature.');
  },
);
