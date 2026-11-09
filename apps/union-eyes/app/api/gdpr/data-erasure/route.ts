/** Data-erasure requests are unavailable until an organization-owned DSAR workflow is implemented. */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';
const unavailable = () => { throw ApiError.notImplemented('Data erasure requests are not implemented; no organization-owned DSAR workflow is authorized.'); };
export const GET = withApi({ auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Data erasure requests — NOT_IMPLEMENTED' } }, unavailable);
export const POST = withApi({ auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Data erasure requests — NOT_IMPLEMENTED' } }, unavailable);
