/**
 * POST /api/admin/pki/signatures/[id]/verify
 *
 * Not implemented. The route verified an attestation record that only the signing route (itself not implemented) could have written, against
 * a signature table no other code populates; an attestation holds no cryptographic signature value, so a verification could confirm a record
 * but never a signature. It answers HTTP 501 rather than present itself as signature verification.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Signatures'],
      summary: '/api/admin/pki/signatures/[id]/verify (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/admin/pki/signatures/[id]/verify is not implemented: no signature record can exist for it to verify, and an attestation holds no cryptographic signature to check.');
  },
);
