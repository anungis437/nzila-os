/**
 * Enterprise data-subject requests — NOT_IMPLEMENTED
 *
 * This was the generic CRUD factory over a subject-owned table that has no owner column and no organization column, so every call was
 * refused by CRUD governance with a 403 that pointed to a dedicated route, and the dedicated route (/api/privacy/dsar) answers 501 as
 * well. No request could be received, and the 403 said the caller lacked permission when the capability does not exist. It now says so.
 *
 * Capability: UE-PRIVACY-DSAR-WORKFLOW (state: NOT_IMPLEMENTED). A request has to be tied to the institution that must answer it, which
 * needs an organization on the table; that is a schema and ownership decision, not something a route can supply.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const MESSAGE =
  'Data subject requests are not implemented. Capability UE-PRIVACY-DSAR-WORKFLOW is NOT_IMPLEMENTED; submit requests to your Privacy Officer.';

export const GET = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Data subject requests — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);

export const POST = withApi(
  { auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Data subject requests — NOT_IMPLEMENTED (HTTP 501)' } },
  async () => {
    throw ApiError.notImplemented(MESSAGE);
  },
);
