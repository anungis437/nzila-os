/**
 * The legacy super-admin role "repair" URI has no verified mandate or
 * authorized repair workflow. It formerly exposed organization membership
 * rows through a generic CRUD facade while POST silently refused mutation.
 * Neither a title nor an endpoint name is a role-grant authorization.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';
const unavailable = () => {
  throw ApiError.notImplemented('Super-admin role repair requires a verified identity mandate and audited workflow');
};
export const GET = withApi({
  auth: { required: true, minRole: 'system_admin' },
  openapi: { tags: ['Admin'], summary: 'Role repair is unavailable until governance approval' },
}, unavailable);
export const POST = withApi({
  auth: { required: true, minRole: 'system_admin' },
  openapi: { tags: ['Admin'], summary: 'Do not grant or repair roles through an unqualified endpoint' },
}, unavailable);
