/**
 * GET /api/admin/users
 * Lists all platform users with optional search by name/email.
 */
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema';
import { desc, eq, sql, or, ilike } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const url = new URL(ctx.request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';

    let query = db
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
      .leftJoin(organizations, eq(sql`${organizations.id}::text`, organizationMembers.organizationId))
      .orderBy(desc(organizationMembers.createdAt))
      .$dynamic();

    if (search) {
      const pattern = `%${search}%`;
      query = query.where(
        or(
          ilike(organizationMembers.name, pattern),
          ilike(organizationMembers.email, pattern),
        ),
      );
    }

    const users = await query.limit(100);

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

