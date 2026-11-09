/** This mislabeled DSAR-table route is unavailable; consent is handled by /api/privacy/consent. */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';
const unavailable = () => { throw ApiError.notImplemented('This legacy GDPR route is not implemented; use the dedicated consent route for consent records.'); };
export const GET = withApi({ auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Legacy GDPR consent route — NOT_IMPLEMENTED' } }, unavailable);
export const POST = withApi({ auth: { required: true }, openapi: { tags: ['Compliance'], summary: 'Legacy GDPR consent route — NOT_IMPLEMENTED' } }, unavailable);
