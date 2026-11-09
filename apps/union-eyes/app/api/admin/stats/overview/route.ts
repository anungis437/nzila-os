/**
 * GET /api/admin/stats/overview
 * Returns platform-wide figures a platform administrator may see: active and total organizations, and database size.
 *
 * Total members and members active today are null ("not measured here"): they are counts of every organization's roster, and a platform
 * title is no standing entitlement to read or derive a union's content, even as an aggregate (issues #1116, #1118). Cross-organization
 * grants are not built, so those figures are not read at all.
 */
import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { count, sql, ne } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';

export const dynamic = 'force-dynamic';

// A platform operation over the platform's own record (the organizations it serves) and the database's size. The platform_lead title is
// only a floor: the read needs the platform-staff mandate (DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY), checked before any statement runs; the
// statements run as the system role. organization_members is not read.
export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    await requirePlatformStaffAuthority(ctx, 'platform.stats.read');
    return readOverview();
  },
);

const readOverview = () => withSystemContext(async () => {
    const [orgStats] = await db
      .select({
        totalOrganizations: count(),
        activeOrganizations: sql<number>`count(*) filter (where ${organizations.status} = 'active')`,
      })
      .from(organizations)
      .where(ne(organizations.organizationType, 'platform'));

    // Estimate storage from the database size (infrastructure).
    const storageResult = await db.execute(
      sql`SELECT pg_database_size(current_database()) as db_size`
    );
    const rows = Array.from(storageResult);
    const dbSizeBytes = Number((rows[0] as Record<string, unknown>)?.db_size ?? 0);
    const totalStorageGb = dbSizeBytes / (1024 * 1024 * 1024);

    return {
      totalMembers: null,
      activeOrganizations: orgStats.activeOrganizations,
      totalOrganizations: orgStats.totalOrganizations,
      totalStorage: Number(totalStorageGb.toFixed(2)),
      activeToday: null,
    };
});
