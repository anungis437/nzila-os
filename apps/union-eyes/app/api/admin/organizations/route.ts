/**
 * GET /api/admin/organizations
 * Lists every organization's tenancy record, with optional search on name or slug.
 *
 * Platform staff manage tenancy and operational metadata, never tenant content (issue #1116): the list gives each organization's
 * identity, type, region, parent, status and record dates. It reads no membership: member counts (live or the stored projection on the
 * organization row) and the names and e-mail addresses of presidents or administrators are the organization's content and are not
 * returned. Cross-organization grants are not built.
 */
import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { ne, ilike, or } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';

export const dynamic = 'force-dynamic';

const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);

// A platform operation over the platform's own record of the organizations it serves. The platform_lead title is only a floor: the read
// needs the platform-staff mandate (DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY), checked before any system transaction is opened. Its one
// statement runs as the system role and touches only the organizations table.
export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    await requirePlatformStaffAuthority(ctx, 'platform.organization_directory.read');
    return listOrganizations(ctx);
  },
);

const listOrganizations = (ctx: { request: Request }) => withSystemContext(async () => {
    const url = new URL(ctx.request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';

    let query = db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        organizationType: organizations.organizationType,
        provinceTerritory: organizations.provinceTerritory,
        parentId: organizations.parentId,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
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

    return orgs.map((o) => ({
      id: String(o.id),
      number: o.slug ?? '',
      name: o.name,
      organizationType: o.organizationType ?? null,
      region: o.provinceTerritory ?? '',
      parentId: o.parentId ? String(o.parentId) : null,
      status: (o.status ?? 'active') as 'active' | 'inactive',
      createdAt: iso(o.createdAt),
      updatedAt: iso(o.updatedAt),
    }));
});
