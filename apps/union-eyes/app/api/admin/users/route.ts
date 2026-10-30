/**
 * GET /api/admin/users
 * Lists membership records only for the active union under a direct
 * administrator mandate. A platform role has no standing access to union
 * membership contacts or records.
 */
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema';
import { and, desc, eq, isNull, sql, or, ilike } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { resolveOrganizationAccess, isAdministrativeRole } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    requireOrg: true,
    rlsOrgContext: true,
  },
  async ({ request, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('Active organization required');
    const authority = await resolveOrganizationAccess(userId);
    if (!isAdministrativeRole(authority.direct.get(organizationId))) {
      throw ApiError.forbidden('Direct organization administrator mandate required');
    }
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';

    const predicate = and(
      eq(organizationMembers.organizationId, organizationId),
      isNull(organizationMembers.deletedAt),
      ...(search ? [or(
        ilike(organizationMembers.name, `%${search.slice(0, 100)}%`),
        ilike(organizationMembers.email, `%${search.slice(0, 100)}%`),
      )] : []),
    );
    const rows = await db
      .select({
        id: organizationMembers.id,
        name: organizationMembers.name,
        email: organizationMembers.email,
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId,
        organizationName: organizations.name,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(predicate)
      .orderBy(desc(organizationMembers.createdAt))
      .limit(100);
    // Defense in depth for DB adapters ignoring an unexpected predicate.
    const users = rows.filter(u => u.organizationId === organizationId);


    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organizationId,
      organizationName: u.organizationName ?? 'Unknown',
      status: u.status ?? 'active',
      lastLogin: null,
      joinedAt: u.joinedAt ?? u.createdAt,
    }));
  },
);

