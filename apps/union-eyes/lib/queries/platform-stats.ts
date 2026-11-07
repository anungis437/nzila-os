/**
 * Platform Stats Queries
 *
 * Shared database queries for platform-wide statistics.
 * Used by both the API route and server components.
 */

import { organizations } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { sql, ne, count } from 'drizzle-orm';

/**
 * A figure derived from organizations' own content (rosters, grievances, collective agreements, role assignments). Issue #1118 / #1116: a
 * platform title or the platform-staff fact is no standing entitlement to read or derive any union's content, even as an aggregate without
 * organization ids. Cross-organization grants are not built, so these figures are not measured here and read null, never zero.
 */
type NotMeasuredHere = null;

export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalMemberCount: NotMeasuredHere;
  totalActiveMemberCount: NotMeasuredHere;
  registeredUsers: NotMeasuredHere;
  activeUsers: NotMeasuredHere;
  organizationTypes: {
    unions: number;
    congresses: number;
    federations: number;
  };
  clcAffiliatedCount: number;
  grievances: NotMeasuredHere;
  collectiveAgreements: NotMeasuredHere;
  sectors: Array<{ sector: string; org_count: number; total_members: NotMeasuredHere }>;
  organizations: Array<{
    id: string;
    name: string;
    organizationType: string;
    status: string;
    memberCount: NotMeasuredHere;
    activeMemberCount: NotMeasuredHere;
    sectors: string[];
    clcAffiliated: boolean | null;
    subscriptionTier: string | null;
    createdAt: Date;
  }>;
  roleDistribution: NotMeasuredHere;
}

/**
 * Platform-wide statistics, read under the system role on purpose: the platform's own record of the organizations it serves (how many, of
 * which type, status, sector and affiliation, and each one's commercial tier) and nothing derived from an organization's content.
 *
 * Member, user, role, grievance and collective-agreement figures are not read: they are null (see {@link NotMeasuredHere}). No query touches
 * organization_members, grievances or collective_agreements; per-organization member counts stored on the organization row are not
 * returned either, since they are a projection of the roster.
 */
export function getPlatformStatsFromDb(reader: { userId: string; organizationId: string }): Promise<PlatformStats> {
  return withSystemContext(async (tx) => {
    const stats = await computePlatformStats(tx as unknown as typeof import('@/db/db').db);
    // The read of every tenant's counts is recorded in the same transaction as the read: no audit record, no data.
    await persistAtomicAudit(tx, {
      userId: reader.userId,
      organizationId: reader.organizationId,
      resourceType: 'platform_stats',
      action: 'platform_stats.read',
      details: { organizationsCounted: stats.totalOrganizations },
    });
    return stats;
  });
}

async function computePlatformStats(db: typeof import('@/db/db').db): Promise<PlatformStats> {
  // ── Organization directory counts (the platform's own record) ──
  const orgStats = await db
    .select({
      totalOrganizations: count(),
      activeOrganizations: sql<number>`count(*) filter (where ${organizations.status} = 'active')`,
      unionCount: sql<number>`count(*) filter (where ${organizations.organizationType} = 'union')`,
      congressCount: sql<number>`count(*) filter (where ${organizations.organizationType} = 'congress')`,
      federationCount: sql<number>`count(*) filter (where ${organizations.organizationType} = 'federation')`,
      clcAffiliatedCount: sql<number>`count(*) filter (where ${organizations.clcAffiliated} = true)`,
    })
    .from(organizations)
    .where(ne(organizations.organizationType, 'platform'));

  // ── Sector breakdown: organizations per declared sector, without their member totals ──
  const sectorBreakdown = await db.execute(sql`
    SELECT 
      unnest(sectors) as sector,
      count(*) as org_count
    FROM organizations 
    WHERE organization_type != 'platform' AND array_length(sectors, 1) > 0
    GROUP BY unnest(sectors)
    ORDER BY org_count DESC
  `);

  // ── Organization list: directory and commercial metadata only ──
  const orgRows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      organizationType: organizations.organizationType,
      status: organizations.status,
      sectors: organizations.sectors,
      clcAffiliated: organizations.clcAffiliated,
      subscriptionTier: organizations.subscriptionTier,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .where(ne(organizations.organizationType, 'platform'));

  const orgList = orgRows.map(o => ({
    ...o,
    status: o.status ?? 'active',
    memberCount: null,
    activeMemberCount: null,
    sectors: (o.sectors ?? []) as string[],
    createdAt: o.createdAt ?? new Date(),
  }));

  const org = orgStats[0];
  const sectors = (Array.from(sectorBreakdown) as Array<{ sector: string; org_count: number | string }>).map((row) => ({
    sector: row.sector,
    org_count: Number(row.org_count),
    total_members: null,
  }));

  return {
    totalOrganizations: Number(org?.totalOrganizations ?? 0),
    activeOrganizations: Number(org?.activeOrganizations ?? 0),
    totalMemberCount: null,
    totalActiveMemberCount: null,
    registeredUsers: null,
    activeUsers: null,
    organizationTypes: {
      unions: Number(org?.unionCount ?? 0),
      congresses: Number(org?.congressCount ?? 0),
      federations: Number(org?.federationCount ?? 0),
    },
    clcAffiliatedCount: Number(org?.clcAffiliatedCount ?? 0),
    grievances: null,
    collectiveAgreements: null,
    sectors,
    organizations: orgList,
    roleDistribution: null,
  };
}
