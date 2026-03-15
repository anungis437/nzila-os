/**
 * GET /api/organization/members?organization=<orgId>
 * Direct DB query — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Organization', 'Members'],
      summary: 'List organization members',
      description: 'Returns members for the specified organization',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization');

    if (!orgId) {
      return { success: true, data: { members: [], stats: { total: 0, active: 0 } } };
    }

    return withSystemContext(async () => {
      const rows = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, orgId),
            isNull(organizationMembers.deletedAt),
          ),
        );

      const activeCount = rows.filter(r => r.status === 'active').length;

      const members = rows.map(m => {
        let metadata: Record<string, unknown> = {};
        if (m.metadata) {
          try { metadata = JSON.parse(m.metadata); } catch { /* ignore */ }
        }
        return {
          id: m.id,
          userId: m.userId,
          name: m.name,
          email: m.email,
          phone: m.phone || '',
          role: m.role,
          status: m.status,
          department: m.department || 'Administration',
          position: m.position || 'Union Member',
          hireDate: m.hireDate?.toISOString() ?? null,
          seniority: m.seniority ?? 0,
          membershipNumber: m.membershipNumber || '',
          unionJoinDate: m.unionJoinDate?.toISOString() ?? null,
          createdAt: m.createdAt?.toISOString() ?? null,
          metadata,
        };
      });

      return {
        success: true,
        data: {
          members,
          stats: { total: rows.length, active: activeCount },
        },
      };
    });
  },
);

