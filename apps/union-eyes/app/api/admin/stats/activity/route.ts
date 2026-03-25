/**
 * GET /api/admin/stats/activity
 * Returns recent activity: latest member additions, org changes, etc.
 */
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const url = new URL(ctx.request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '10'), 50);

    // Recent member additions as activity feed
    const recentMembers = await db
      .select({
        id: organizationMembers.id,
        name: organizationMembers.name,
        email: organizationMembers.email,
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId,
        orgName: organizations.name,
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .leftJoin(organizations, eq(sql`${organizations.id}::text`, organizationMembers.organizationId))
      .orderBy(desc(organizationMembers.createdAt))
      .limit(limit);

    const activity = recentMembers.map((m) => ({
      id: m.id,
      type: 'member_added',
      description: `${m.name} joined ${m.orgName ?? 'organization'} as ${m.role}`,
      user: m.name,
      email: m.email,
      organizationName: m.orgName,
      timestamp: m.createdAt,
    }));

    return activity;
  },
);

