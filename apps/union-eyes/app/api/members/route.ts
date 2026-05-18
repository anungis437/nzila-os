/**
 * GET /api/members
 * List organization members — used by mobile page and membersAPI.list().
 * Query params: organizationId, search, status, limit, offset
 */
import { withApi } from '@/lib/api/framework';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';
import { auditDataAccess } from '@/lib/audit-logger';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

/** Roles whose level is ≥ system_admin (200) can access any org's members. */
const PLATFORM_ADMIN_THRESHOLD = ROLE_HIERARCHY['system_admin' as keyof typeof ROLE_HIERARCHY];

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members'],
      summary: 'List members',
      description: 'Returns paginated members for the organization.',
    },
  },
  async ({ request, organizationId, userId, user }) => {
    const url = new URL(request.url);
    const requestedOrgId = url.searchParams.get('organizationId');
    const orgId = requestedOrgId || organizationId;
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    if (!orgId) {
      return { members: [], total: 0 };
    }

    // Validate that the caller belongs to the requested org unless they are a platform admin.
    // This prevents authenticated users from enumerating members of other organisations.
    if (requestedOrgId && requestedOrgId !== organizationId) {
      const callerRole = normalizeRole(user?.role ?? 'member');
      const callerLevel = ROLE_HIERARCHY[callerRole as keyof typeof ROLE_HIERARCHY] ?? 0;
      const isPlatformAdmin = callerLevel >= PLATFORM_ADMIN_THRESHOLD;

      if (!isPlatformAdmin) {
        const callerMembership = await db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId!),
              eq(organizationMembers.organizationId, requestedOrgId),
              eq(organizationMembers.status, 'active'),
              isNull(organizationMembers.deletedAt),
            ),
          )
          .limit(1);

        if (callerMembership.length === 0) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'You do not have access to this organisation.' },
            { status: 403 },
          );
        }
      }
    }

    const conditions = [
      eq(organizationMembers.organizationId, orgId),
      isNull(organizationMembers.deletedAt),
    ];

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

    const members = rows.map(m => {
      let metadata: Record<string, unknown> = {};
      if (m.metadata) {
        // `organizationMembers.metadata` is jsonb in the canonical schema, so
        // postgres-js returns it as an already-parsed object. Tolerate the
        // historical text representation by JSON.parse-ing strings.
        if (typeof m.metadata === 'string') {
          try { metadata = JSON.parse(m.metadata); } catch { /* ignore */ }
        } else if (typeof m.metadata === 'object') {
          metadata = m.metadata as Record<string, unknown>;
        }
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

    await auditDataAccess({
      userId: userId!,
      organizationId: orgId!,
      resource: 'organization_members',
      action: 'list',
      details: { count: members.length, search: search || undefined, status: statusFilter || undefined },
    });

    return { members, total: members.length };
  },
);
