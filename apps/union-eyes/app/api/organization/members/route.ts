/**
 * GET /api/organization/members
 * Direct DB query — replaces Django proxy. Organization comes from the session; the rows a
 * caller may see come from the member-directory policy (case-context for stewards).
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, or, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { memberDirectoryAccess, projectDirectoryMember } from '@/lib/members/directory-access';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Organization', 'Members'],
      summary: 'List organization members',
      description: 'Returns the members the caller is authorized to see in the active organization',
    },
  },
  async ({ organizationId, userId, user }) => {
    // Org scope comes from the authenticated session (resolved + enforced by
    // withApi), never from a client-suppliable value — a prior version of
    // this route trusted an `?organization=` query parameter directly,
    // which let any authenticated steward+ read any other org's roster.
    if (!organizationId) {
      return { members: [], stats: { total: 0, active: 0 } };
    }

    const access = memberDirectoryAccess(user?.role);
    if (access.scope === 'none' || !userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Member directory access is not part of your current mandate.' },
        { status: 403 },
      );
    }

    return withRLSContext(async () => {
      const conditions = [
        eq(organizationMembers.organizationId, organizationId),
        isNull(organizationMembers.deletedAt),
      ];
      if (access.scope === 'case-context') {
        conditions.push(
          or(
            eq(organizationMembers.userId, userId),
            sql`EXISTS (
              SELECT 1 FROM claims c
              WHERE c.member_id = ${organizationMembers.userId}
                AND c.organization_id::text = ${organizationMembers.organizationId}::text
                AND c.assigned_to = ${userId}
            )`,
          )!,
        );
      }

      const rows = await db
        .select()
        .from(organizationMembers)
        .where(and(...conditions));

      const activeCount = rows.filter(r => r.status === 'active').length;

      const members = rows.map(m => ({
        ...projectDirectoryMember(m, access),
        location: m.location || '',
      }));

      return {
        members,
        stats: { total: rows.length, active: activeCount },
      };
    });
  },
);
