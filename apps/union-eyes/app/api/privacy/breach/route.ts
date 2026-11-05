/**
 * Privacy incident (breach) management — NOT_IMPLEMENTED
 *
 * This route was previously bound to generic CRUD over
 * `dataClassificationPolicy`, i.e. platform-wide classification doctrine, not
 * privacy-incident records. A breach-management request could therefore read
 * or mutate unrelated platform policy while appearing to be an incident
 * workflow. It now fails closed.
 *
 * Capability: UE-PRIVACY-INCIDENT-WORKFLOW (state: NOT_IMPLEMENTED)
 * Platform classification policy lives at /api/compliance/data-classification-policy.
 *
 * A real implementation requires dedicated incident storage, an accountable
 * decision-maker, jurisdiction/applicable-law determination, human legal
 * review and a distinct "dispatch" step. No notification is sent from here.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const MESSAGE =
  'Privacy incident management is not implemented. Capability UE-PRIVACY-INCIDENT-WORKFLOW is NOT_IMPLEMENTED; ' +
  'this endpoint no longer exposes classification-policy records. Refer incidents to your Privacy Officer.';

export const GET = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Privacy incidents — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);

export const POST = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Privacy incidents — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);
