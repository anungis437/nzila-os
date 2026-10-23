/**
 * GET /api/members
 * List organization members — used by mobile page and membersAPI.list().
 * Query params: organizationId, search, status, limit, offset
 */
import { withApi } from '@/lib/api/framework';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, ilike, or, sql } from 'drizzle-orm';
import { auditDataAccess } from '@/lib/audit-logger';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { memberDirectoryAccess, projectDirectoryMember } from '@/lib/members/directory-access';

export const dynamic = 'force-dynamic';

/** Roles whose level is ≥ system_admin (200) can access any org's members. */
const PLATFORM_ADMIN_THRESHOLD = ROLE_HIERARCHY['system_admin' as keyof typeof ROLE_HIERARCHY];

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Members'],
      summary: 'List members',
      description:
        'Returns members the caller is authorized to see: case-context members for a steward, ' +
        'the organization directory for case_read_any roles. The active organization is derived server-side.',
    },
  },
  async ({ request, organizationId, userId, user }) => {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get('organizationId');
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    const callerRole = normalizeRole(user?.role ?? 'member');
    const callerLevel = ROLE_HIERARCHY[callerRole as keyof typeof ROLE_HIERARCHY] ?? 0;
    const isPlatformAdmin = callerLevel >= PLATFORM_ADMIN_THRESHOLD;

    // The query string is a hint, never authority: only platform administrators may cross organizations.
    if (requestedOrgId && requestedOrgId !== organizationId && !isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this organisation.' },
        { status: 403 },
      );
    }
    const orgId = isPlatformAdmin ? requestedOrgId || organizationId : organizationId;

    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Forbidden', message: 'Organization context required.' }, { status: 403 });
    }

    const access = memberDirectoryAccess(callerRole, isPlatformAdmin);
    if (access.scope === 'none') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Member directory access is not part of your current mandate.' },
        { status: 403 },
      );
    }

    const conditions = [
      eq(organizationMembers.organizationId, orgId),
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

    if (statusFilter) {
      conditions.push(eq(organizationMembers.status, statusFilter));
    }

    if (search) {
      conditions.push(
        or(
          ilike(organizationMembers.name, `%${search}%`),
          ilike(organizationMembers.email, `%${search}%`),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(organizationMembers)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const members = rows.map(m => projectDirectoryMember(m, access));

    await auditDataAccess({
      userId,
      organizationId: orgId,
      resource: 'organization_members',
      action: 'list',
      details: {
        count: members.length,
        scope: access.scope,
        search: search || undefined,
        status: statusFilter || undefined,
      },
    });

    return { members, total: members.length };
  },
);
