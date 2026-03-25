/**
 * GET /api/v2/organization/members/search?organization=<orgId>&q=<query>
 * Direct DB query — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, or, ilike } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Organization', 'Members'],
      summary: 'Search organization members (v2)',
      description: 'Search members by name or email within an organization',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization');
    const q = url.searchParams.get('q') || '';

    if (!orgId) {
      return { members: [] };
    }

    return withSystemContext(async () => {
      const conditions = [
        eq(organizationMembers.organizationId, orgId),
        isNull(organizationMembers.deletedAt),
      ];

      if (q) {
        conditions.push(
          or(
            ilike(organizationMembers.name, `%${q}%`),
            ilike(organizationMembers.email, `%${q}%`),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(organizationMembers)
        .where(and(...conditions))
        .limit(50);

      const members = rows.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
        department: m.department,
        membershipNumber: m.membershipNumber || '',
      }));

      return { members };
    });
  },
);
