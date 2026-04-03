/**
 * Segment Preview
 *
 * POST /api/members/segments/preview
 *
 * Body: { filters: SegmentFilter[] }
 *
 * Counts the number of organization members that would match the given
 * segment criteria. Used for preview before saving a saved segment.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { organizationMembers } from '@/db/schema-organizations';
import { eq, and, type SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type SegmentFilter = {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value: string;
};

/**
 * Build a WHERE condition for a single filter against organization_members columns.
 */
function buildCondition(filter: SegmentFilter, _orgId: string): SQL | null {
  const { field, operator, value } = filter;

  // Safelist of allowed fields to prevent SQL injection
  const ALLOWED_FIELDS: Record<string, string> = {
    status: 'status',
    role: 'role',
    department: 'department',
    location: 'location',
    membershipType: 'membership_type',
  };

  const col = ALLOWED_FIELDS[field];
  if (!col) return null;

  switch (operator) {
    case 'eq':
      return sql`${sql.identifier(col)} = ${value}`;
    case 'neq':
      return sql`${sql.identifier(col)} != ${value}`;
    case 'contains':
      return sql`${sql.identifier(col)} ILIKE ${'%' + value + '%'}`;
    default:
      return null;
  }
}

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Members'], summary: 'Preview segment member count' },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = await request.json() as { filters?: SegmentFilter[] };
    const filters = body.filters ?? [];

    const conditions: SQL[] = [
      eq(organizationMembers.organizationId, organizationId),
    ];

    for (const filter of filters) {
      const cond = buildCondition(filter, organizationId);
      if (cond) conditions.push(cond);
    }

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(and(...conditions));

    const count = result[0]?.count ?? 0;
    return { count };
  },
);
