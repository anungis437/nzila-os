/**
 * GET /api/admin/stats/overview
 * Returns system-wide stats: total members, active orgs, total orgs, storage, active today.
 */
import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { organizationMembers } from '@/db/schema';
import { count, sql, ne } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async () => {
    const [memberStats] = await db
      .select({ totalMembers: count() })
      .from(organizationMembers);

    const [orgStats] = await db
      .select({
        totalOrganizations: count(),
        activeOrganizations: sql<number>`count(*) filter (where ${organizations.status} = 'active')`,
      })
      .from(organizations)
      .where(ne(organizations.organizationType, 'platform'));

    // Estimate storage from table sizes
    const storageResult = await db.execute(
      sql`SELECT pg_database_size(current_database()) as db_size`
    );
    const rows = Array.from(storageResult);
    const dbSizeBytes = Number((rows[0] as Record<string, unknown>)?.db_size ?? 0);
    const totalStorageGb = dbSizeBytes / (1024 * 1024 * 1024);

    // Active today: members with recent activity (created/updated in last 24h)
    const [activeResult] = await db
      .select({ activeToday: sql<number>`count(distinct user_id)` })
      .from(organizationMembers)
      .where(sql`${organizationMembers.updatedAt} >= now() - interval '24 hours'
        OR ${organizationMembers.createdAt} >= now() - interval '24 hours'`);

    return {
      totalMembers: memberStats.totalMembers,
      activeOrganizations: orgStats.activeOrganizations,
      totalOrganizations: orgStats.totalOrganizations,
      totalStorage: Number(totalStorageGb.toFixed(2)),
      activeToday: activeResult.activeToday ?? 0,
    };
  },
);

