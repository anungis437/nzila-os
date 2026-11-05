/**
 * Provincial / jurisdictional privacy cases — NOT_IMPLEMENTED
 *
 * Previously bound to generic CRUD over `dataClassificationPolicy`. No
 * jurisdictional case store or source-backed legal-rule engine exists behind
 * this route, so it now fails closed rather than imply one.
 *
 * Capability: UE-PRIVACY-PROVINCIAL-CASES (state: NOT_IMPLEMENTED)
 * Platform classification policy lives at /api/compliance/data-classification-policy.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const MESSAGE =
  'Provincial privacy case handling is not implemented. Capability UE-PRIVACY-PROVINCIAL-CASES is NOT_IMPLEMENTED; ' +
  'this endpoint no longer exposes classification-policy records.';

export const GET = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Provincial privacy cases — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);

export const POST = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Provincial privacy cases — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);
