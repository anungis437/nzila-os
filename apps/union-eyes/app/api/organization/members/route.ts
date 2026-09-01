/**
 * GET /api/organization/members?organization=<orgId>
 * Direct DB query — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

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
  async ({ organizationId }) => {
    // Org scope comes from the authenticated session (resolved + enforced by
    // withApi), never from a client-suppliable value — a prior version of
    // this route trusted an `?organization=` query parameter directly,
    // which let any authenticated steward+ read any other org's roster.
    if (!organizationId) {
      return { members: [], stats: { total: 0, active: 0 } };
    }

    return withRLSContext(async () => {
      const rows = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            isNull(organizationMembers.deletedAt),
          ),
        );

      const activeCount = rows.filter(r => r.status === 'active').length;

      const members = rows.map(m => {
        const metadata = (m.metadata && typeof m.metadata === 'object') ? m.metadata as Record<string, unknown> : {};
        return {
          id: m.id,
          userId: m.userId,
          name: m.name,
          email: m.email,
          phone: m.phone || '',
          role: m.role,
          status: m.status,
          department: m.department || 'Administration',
          location: m.location || '',
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
        members,
        stats: { total: rows.length, active: activeCount },
      };
    });
  },
);

