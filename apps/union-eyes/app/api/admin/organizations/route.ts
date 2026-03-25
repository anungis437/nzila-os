/**
 * GET /api/admin/organizations
 * Lists all organizations with optional search.
 */
import { db } from '@/db/db';
import { organizations, organizationMembers } from '@/db/schema';
import { sql, ne, ilike, or, eq, count } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const url = new URL(ctx.request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';

    let query = db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        organizationType: organizations.organizationType,
        provinceTerritory: organizations.provinceTerritory,
        memberCount: organizations.memberCount,
        activeMemberCount: organizations.activeMemberCount,
        status: organizations.status,
      })
      .from(organizations)
      .where(ne(organizations.organizationType, 'platform'))
      .$dynamic();

    if (search) {
      const pattern = `%${search}%`;
      query = query.where(
        or(
          ilike(organizations.name, pattern),
          ilike(organizations.slug, pattern),
        ),
      );
    }

    const orgs = await query;

    // Get live member counts per org
    const memberCounts = await db
      .select({
        organizationId: organizationMembers.organizationId,
        total: count(),
        active: sql<number>`count(*) filter (where ${organizationMembers.status} = 'active')`,
      })
      .from(organizationMembers)
      .groupBy(organizationMembers.organizationId);

    const countMap = new Map(memberCounts.map(c => [c.organizationId, c]));

    // Get a president/admin contact per org
    const contacts = await db
      .select({
        organizationId: organizationMembers.organizationId,
        name: organizationMembers.name,
        email: organizationMembers.email,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(
        or(
          eq(organizationMembers.role, 'president'),
          eq(organizationMembers.role, 'admin'),
        ),
      );
    const contactMap = new Map<string, { name: string; email: string }>();
    for (const c of contacts) {
      if (!contactMap.has(c.organizationId)) {
        contactMap.set(c.organizationId, { name: c.name, email: c.email });
      }
    }

    return orgs.map((o) => {
      const mc = countMap.get(String(o.id));
      const contact = contactMap.get(String(o.id));
      return {
        id: String(o.id),
        number: o.slug ?? '',
        name: o.name,
        region: o.provinceTerritory ?? '',
        memberCount: mc?.total ?? o.memberCount ?? 0,
        activeCount: mc?.active ?? o.activeMemberCount ?? 0,
        president: contact?.name ?? '',
        contact: contact?.email ?? '',
        status: (o.status ?? 'active') as 'active' | 'inactive',
      };
    });
  },
);

