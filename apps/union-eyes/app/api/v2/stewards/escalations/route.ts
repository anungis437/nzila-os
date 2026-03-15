/**
 * GET /api/v2/stewards/escalations
 * Direct DB — pending escalation cases for the chief steward dashboard.
 * Returns: Array<{ id, member, steward, reason }>
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { stewards, stewardAssignments } from '@/db/schema';
import { grievances } from '@/db/schema';
import { organizationMembers } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'chief_steward' },
    openapi: {
      tags: ['Stewards'],
      summary: 'Pending escalation cases',
      description: 'Returns grievances with escalated status that require chief steward review.',
    },
  },
  async () => {
    return withSystemContext(async () => {
      // Get escalated grievances with their steward assignments
      const rows = await db
        .select({
          grievanceId: grievances.id,
          grievanceNumber: grievances.grievanceNumber,
          grievantName: grievances.grievantName,
          title: grievances.title,
          stewardId: stewardAssignments.stewardId,
        })
        .from(grievances)
        .leftJoin(stewardAssignments, eq(stewardAssignments.grievanceId, grievances.id))
        .where(eq(grievances.status, 'escalated'))
        .orderBy(grievances.escalatedAt)
        .limit(50);

      if (rows.length === 0) return [];

      // Look up steward names
      const stewardIds = [...new Set(rows.map(r => r.stewardId).filter(Boolean))] as string[];
      const stewardNameMap = new Map<string, string>();

      if (stewardIds.length > 0) {
        const stewardRows = await db
          .select({ id: stewards.id, userId: stewards.userId })
          .from(stewards)
          .where(sql`${stewards.id}::text IN (${sql.join(stewardIds.map(id => sql`${id}::text`), sql`, `)})`);

        if (stewardRows.length > 0) {
          const userIds = stewardRows.map(s => s.userId);
          const members = await db
            .select({ userId: organizationMembers.userId, name: organizationMembers.name })
            .from(organizationMembers)
            .where(sql`${organizationMembers.userId}::text IN (${sql.join(userIds.map(id => sql`${id}::text`), sql`, `)})`);

          const userNameMap = new Map(members.map(m => [m.userId, m.name ?? 'Unknown']));
          stewardRows.forEach(s => {
            stewardNameMap.set(s.id, userNameMap.get(s.userId) ?? 'Unknown');
          });
        }
      }

      return rows.map(r => ({
        id: r.grievanceNumber,
        member: r.grievantName ?? 'Unknown',
        steward: r.stewardId ? (stewardNameMap.get(r.stewardId) ?? 'Unassigned') : 'Unassigned',
        reason: r.title,
      }));
    });
  },
);
