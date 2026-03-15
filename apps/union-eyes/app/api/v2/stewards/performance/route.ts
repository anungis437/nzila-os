/**
 * GET /api/v2/stewards/performance
 * Direct DB — per-steward case handling stats for the chief steward dashboard.
 * Returns: Array<{ name, active, completed, successRate }>
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { stewards, stewardAssignments } from '@/db/schema';
import { organizationMembers } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'chief_steward' },
    openapi: {
      tags: ['Stewards'],
      summary: 'Per-steward performance stats',
      description: 'Returns active and completed case counts per steward with success rate.',
    },
  },
  async () => {
    return withSystemContext(async () => {
      // Get all active stewards with their assignment counts
      const rows = await db
        .select({
          stewardId: stewards.id,
          userId: stewards.userId,
          active: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} = 'active')::int`,
          completed: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} = 'completed')::int`,
          total: sql<number>`count(*) FILTER (WHERE ${stewardAssignments.status} NOT IN ('pending', 'declined'))::int`,
        })
        .from(stewards)
        .leftJoin(stewardAssignments, eq(stewardAssignments.stewardId, stewards.id))
        .where(eq(stewards.active, true))
        .groupBy(stewards.id, stewards.userId);

      if (rows.length === 0) return [];

      // Look up steward names from organization members
      const userIds = rows.map(r => r.userId);
      const members = await db
        .select({ userId: organizationMembers.userId, name: organizationMembers.name })
        .from(organizationMembers)
        .where(sql`${organizationMembers.userId}::text IN (${sql.join(userIds.map(id => sql`${id}::text`), sql`, `)})`);

      const nameMap = new Map(members.map(m => [m.userId, m.name ?? 'Unknown']));

      return rows.map(r => ({
        name: nameMap.get(r.userId) ?? 'Unknown',
        active: r.active,
        completed: r.completed,
        successRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
      }));
    });
  },
);
