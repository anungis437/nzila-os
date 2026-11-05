/**
 * GET/POST /api/admin/fix-super-admin-roles
 *
 * The former handler was a generic CRUD facade over organization_members.
 * It never repaired roles, exposed a member roster under a misleading route,
 * and advertised system-admin authority while accepting ordinary admins.
 *
 * Role restoration requires a separately designed and approved privileged
 * workflow with identity, mandate, before/after audit and rollback evidence.
 * Until then, refuse the operation explicitly rather than returning a fake
 * repair success or allowing arbitrary membership creation.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const unavailable = () => NextResponse.json(
  {
    error: 'GOVERNED_ROLE_REPAIR_NOT_IMPLEMENTED',
    message: 'Automated administrator role repair is unavailable. Use the governed identity and role recovery process.',
  },
  { status: 501 },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'system_admin' },
    requireOrg: false,
    openapi: {
      tags: ['Administration'],
      summary: 'Administrator role repair status (not implemented)',
      description: 'No member roster is exposed. Privileged role recovery requires an independently approved and audited workflow.',
    },
  },
  unavailable,
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'system_admin' },
    requireOrg: false,
    openapi: {
      tags: ['Administration'],
      summary: 'Administrator role repair (not implemented)',
      description: 'Explicitly refuses role mutations until a governed recovery workflow exists.',
    },
  },
  unavailable,
);
