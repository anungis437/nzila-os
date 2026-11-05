/**
 * GET /api/organization/members/search?q=<query>
 * Direct DB query — replaces Django proxy. Organization comes from the session; the rows a
 * caller may see come from the member-directory policy (case-context for stewards).
 */
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, asc, isNull, or, ilike, sql } from 'drizzle-orm';
import { ApiError, withApi } from '@/lib/api/framework';
import { likeContaining, SEARCH_TERM_MAX_LENGTH } from '@/lib/api/like-pattern';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { memberDirectoryAccess } from '@/lib/members/directory-access';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Organization', 'Members'],
      summary: 'Search organization members',
      description: 'Search the members the caller is authorized to see by name or email within the active organization',
    },
  },
  async ({ request, organizationId, userId, user }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length > SEARCH_TERM_MAX_LENGTH) throw ApiError.badRequest(`q must be at most ${SEARCH_TERM_MAX_LENGTH} characters`);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('limit') ?? PAGE_SIZE) || PAGE_SIZE, 1), PAGE_SIZE);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);

    // Org scope comes from the authenticated session (resolved + enforced by
    // withApi), never from a client-suppliable value — a prior version of
    // this route trusted an `?organization=` query parameter directly,
    // which let any authenticated steward+ search any other org's roster.
    if (!organizationId) {
      return { members: [] };
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

      if (q) {
        conditions.push(
          or(
            ilike(organizationMembers.name, likeContaining(q)),
            ilike(organizationMembers.email, likeContaining(q)),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(organizationMembers)
        .where(and(...conditions))
        .orderBy(asc(organizationMembers.name), asc(organizationMembers.id))
        .limit(pageSize)
        .offset(offset);

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
