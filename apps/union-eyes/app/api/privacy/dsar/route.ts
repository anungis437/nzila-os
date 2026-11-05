/**
 * Data-subject / information-rights requests — NOT_IMPLEMENTED
 *
 * Previously bound to generic CRUD over `dataClassificationPolicy`. A rights
 * request must distinguish receipt, identity verification, scope, lawful
 * exemptions, response authorization, delivery and completion; none of that
 * exists behind this route, so it now fails closed.
 *
 * Capability: UE-PRIVACY-DSAR-WORKFLOW (state: NOT_IMPLEMENTED)
 * Platform classification policy lives at /api/compliance/data-classification-policy.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const MESSAGE =
  'Information-rights (DSAR) handling is not implemented. Capability UE-PRIVACY-DSAR-WORKFLOW is NOT_IMPLEMENTED; ' +
  'this endpoint no longer exposes classification-policy records. Submit requests to your Privacy Officer.';

export const GET = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Information-rights requests — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);

export const POST = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Information-rights requests — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);
