/**
 * GET /api/organization/members/search?organization=<orgId>&q=<query>
 * Direct DB query — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, or, ilike } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Organization', 'Members'],
      summary: 'Search organization members',
      description: 'Search members by name or email within an organization',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';

    // Org scope comes from the authenticated session (resolved + enforced by
    // withApi), never from a client-suppliable value — a prior version of
    // this route trusted an `?organization=` query parameter directly,
    // which let any authenticated steward+ search any other org's roster.
    if (!organizationId) {
      return { members: [] };
    }

    return withRLSContext(async () => {
      const conditions = [
        eq(organizationMembers.organizationId, organizationId),
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

