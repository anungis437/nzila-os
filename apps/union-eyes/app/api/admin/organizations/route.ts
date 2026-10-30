/**
 * Tenant-admin organization directory. A platform title does not confer
 * access to another union's contacts, membership counts or organization.
 * Cross-union platform listings require a separate, verified and audited
 * institutional mandate; this ordinary endpoint does not issue one.
 */
import { db } from '@/db/db';
import { organizations, organizationMembers } from '@/db/schema';
import { and, sql, ne, ilike, or, eq, count } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'platform_lead' },
  requireOrg: true,
  rlsOrgContext: true,
}, async ({ request, userId, organizationId }) => {
  if (!userId || !organizationId) throw ApiError.forbidden('Active organization required');
  const access = await resolveOrganizationAccess(userId);
  if (!isAdministrativeRole(access.direct.get(organizationId))) {
    throw ApiError.forbidden('A direct organization administration mandate is required');
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
  // Dynamic Drizzle .where calls replace (not accumulate) predicates.
  // Build one immutable scoped predicate before applying optional search.
  const predicate = and(
    eq(organizations.id, organizationId),
    ne(organizations.organizationType, 'platform'),
    ...(search ? [or(
      ilike(organizations.name, `%${search}%`),
      ilike(organizations.slug, `%${search}%`),
    )] : []),
  );
  const orgs = await db.select({
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    organizationType: organizations.organizationType,
    provinceTerritory: organizations.provinceTerritory,
    memberCount: organizations.memberCount,
    activeMemberCount: organizations.activeMemberCount,
    status: organizations.status,
  }).from(organizations).where(predicate).limit(50);

  const memberCounts = await db.select({
    organizationId: organizationMembers.organizationId,
    total: count(),
    active: sql<number>`count(*) filter (where ${organizationMembers.status} = 'active')`,
  }).from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId))
    .groupBy(organizationMembers.organizationId);

  // Contact data remains inside the organization the caller administers.
  const contacts = await db.select({
    organizationId: organizationMembers.organizationId,
    name: organizationMembers.name,
    email: organizationMembers.email,
    role: organizationMembers.role,
  }).from(organizationMembers).where(and(
    eq(organizationMembers.organizationId, organizationId),
    or(eq(organizationMembers.role, 'president'), eq(organizationMembers.role, 'admin')),
  )).limit(25);

  const countMap = new Map(memberCounts.map(c => [c.organizationId, c]));
  const contact = contacts[0];
  return orgs.map(o => {
    const mc = countMap.get(o.id);
    return {
      id: o.id,
      number: o.slug ?? '',
      name: o.name,
      region: o.provinceTerritory ?? '',
      memberCount: mc?.total ?? o.memberCount ?? 0,
      activeCount: mc?.active ?? o.activeMemberCount ?? 0,
      president: contact?.name ?? '',
      contact: contact?.email ?? '',
      status: o.status ?? 'active',
    };
  });
});
