/**
 * GET /api/members
 * List organization members — used by mobile page and membersAPI.list().
 * Query params: organizationId, search, status, limit, offset
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';
import { auditDataAccess } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members'],
      summary: 'List members',
      description: 'Returns paginated members for the organization.',
    },
  },
  async ({ request, organizationId, userId }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organizationId') || organizationId;
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    if (!orgId) {
      return { members: [], total: 0 };
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
