/**
 * CRUD item route for organizations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizations } from '@/db/schema';
import { requireOwnOrganizationItem } from '@/lib/api/require-own-organization-item';

export const dynamic = 'force-dynamic';

const { GET: rawGET, PATCH: rawPATCH, DELETE: rawDELETE } = crudRoutes({
  table: organizations,
  pk: 'id',
  tags: ["Organizations"],
  orgScoped: false,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});

// PR #752 round 11: see lib/api/require-own-organization-item.ts — closes
// the same cross-tenant IDOR as sharing-settings/route.ts.
export const GET = requireOwnOrganizationItem('id', rawGET);
export const PATCH = requireOwnOrganizationItem('id', rawPATCH);
export const DELETE = requireOwnOrganizationItem('id', rawDELETE);

