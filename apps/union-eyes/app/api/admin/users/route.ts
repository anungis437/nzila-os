/**
 * GET /api/admin/users
 * Lists all platform users with optional search by name/email.
 */
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema';
import { desc, sql, or, ilike } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';
import { performAuditedPlatformRead } from '@/lib/audit/audited-platform-read';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const url = new URL(ctx.request.url);
    // A bounded term, with the pattern characters of LIKE taken literally.
    const search = (url.searchParams.get('search')?.trim() ?? '').slice(0, 100).replace(/[\\%_]/g, '\\$&');

    return performAuditedPlatformRead(
      ctx,
      { action: 'platform.user_directory.read', resourceType: 'organization_members', details: { searched: search.length > 0, limit: 100 } },
      async () => {
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
      .leftJoin(organizations, sql`${organizations.id}::text = ${organizationMembers.organizationId}::text`)
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
  },
);

