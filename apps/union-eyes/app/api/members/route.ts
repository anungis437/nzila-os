/**
 * GET /api/members
 * List organization members — used by mobile page and membersAPI.list().
 * Query params: organizationId, search, status, limit, offset
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';

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
  async ({ request, organizationId }) => {
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

    return { members, total: members.length };
  },
);
