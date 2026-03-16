/**
 * Sector Analytics Page
 * Industry-wide trends and sector breakdown from real database
 *
 * @role platform_lead
 * @dashboard_path /dashboard/sector-analytics
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';

/* ── Types ── */
interface OrgRow {
  id: string;
  name: string;
  organizationType: string;
  sectors: string[];
  status: string;
  memberCount: number;
  activeMemberCount: number;
  clcAffiliated: boolean;
  subscriptionTier: string | null;
  ticketCount: number;
  loginCount: number;
}

interface SectorSummary {
  sector: string;
  orgCount: number;
  totalMembers: number;
  activeMembers: number;
  cbaCount: number;
  grievanceCount: number;
  ticketCount: number;
}

interface CbaStats {
  total: number;
  active: number;
  negotiating: number;
  expired: number;
}

interface GrievanceStats {
  total: number;
  open: number;
  resolved: number;
  inArbitration: number;
}

interface SettlementStats {
  total: number;
  totalMonetaryValue: number;
}

interface Overview {
  totalOrgs: number;
  activeOrgs: number;
  totalMembers: number;
  activeMembers: number;
  sectorCount: number;
}

/* ── Data loaders ── */
async function loadOverview(): Promise<Overview> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT COUNT(*)::int as total_orgs,
        COUNT(*) FILTER (WHERE status = 'active')::int as active_orgs,
        COALESCE(SUM(member_count), 0)::int as total_members,
        COALESCE(SUM(active_member_count), 0)::int as active_members
      FROM organizations
      WHERE organization_type NOT IN ('platform', 'congress')
    `)
  );
  const r = rows[0] as Record<string, unknown>;
  // Get distinct sectors
  const sectorRows = Array.from(
    await db.execute(sql`
      SELECT COUNT(DISTINCT s)::int as cnt
      FROM organizations, unnest(sectors) s
      WHERE organization_type NOT IN ('platform', 'congress')
    `)
  );
  const sc = sectorRows[0] as Record<string, unknown>;
  return {
    totalOrgs: Number(r.total_orgs),
    activeOrgs: Number(r.active_orgs),
    totalMembers: Number(r.total_members),
    activeMembers: Number(r.active_members),
    sectorCount: Number(sc.cnt),
  };
}

async function loadOrganizations(): Promise<OrgRow[]> {
  return Array.from(
    await db.execute(sql`
      SELECT o.id, o.name, o.organization_type, o.sectors, o.status,
        COALESCE(o.member_count, 0)::int as member_count,
        COALESCE(o.active_member_count, 0)::int as active_member_count,
        COALESCE(o.clc_affiliated, false) as clc_affiliated,
        o.subscription_tier,
        COALESCE(st.ticket_count, 0)::int as ticket_count,
        COALESCE(le.login_count, 0)::int as login_count
      FROM organizations o
      LEFT JOIN (
        SELECT organization_id, COUNT(*)::int as ticket_count
        FROM support_tickets GROUP BY organization_id
      ) st ON st.organization_id = o.id
      LEFT JOIN (
        SELECT organization_id, COUNT(*)::int as login_count
        FROM platform_login_events
        WHERE logged_in_at >= now() - interval '30 days'
        GROUP BY organization_id
      ) le ON le.organization_id = o.id
      WHERE o.organization_type NOT IN ('platform', 'congress')
      ORDER BY o.member_count DESC NULLS LAST
    `)
  ).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name),
    organizationType: String(r.organization_type),
    sectors: Array.isArray(r.sectors) ? (r.sectors as string[]) : [],
    status: String(r.status),
    memberCount: Number(r.member_count),
    activeMemberCount: Number(r.active_member_count),
    clcAffiliated: Boolean(r.clc_affiliated),
    subscriptionTier: r.subscription_tier ? String(r.subscription_tier) : null,
    ticketCount: Number(r.ticket_count),
    loginCount: Number(r.login_count),
  }));
}

async function loadSectorBreakdown(): Promise<SectorSummary[]> {
  return Array.from(
    await db.execute(sql`
      SELECT s as sector,
        COUNT(DISTINCT o.id)::int as org_count,
        COALESCE(SUM(o.member_count), 0)::int as total_members,
        COALESCE(SUM(o.active_member_count), 0)::int as active_members
      FROM organizations o, unnest(o.sectors) s
      WHERE o.organization_type NOT IN ('platform', 'congress')
      GROUP BY s
      ORDER BY total_members DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    sector: String(r.sector),
    orgCount: Number(r.org_count),
    totalMembers: Number(r.total_members),
    activeMembers: Number(r.active_members),
    cbaCount: 0,
    grievanceCount: 0,
    ticketCount: 0,
  }));
}

async function loadCbaStats(): Promise<CbaStats> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'active')::int as active,
        COUNT(*) FILTER (WHERE status = 'under_negotiation')::int as negotiating,
        COUNT(*) FILTER (WHERE status = 'expired')::int as expired
      FROM collective_agreements
    `)
  );
  const r = rows[0] as Record<string, unknown>;
  return {
    total: Number(r.total),
    active: Number(r.active),
    negotiating: Number(r.negotiating),
    expired: Number(r.expired),
  };
}

async function loadGrievanceStats(): Promise<GrievanceStats> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('filed', 'investigating', 'escalated', 'mediation'))::int as open,
        COUNT(*) FILTER (WHERE status = 'settled')::int as resolved,
        COUNT(*) FILTER (WHERE status = 'arbitration')::int as in_arbitration
      FROM grievances
    `)
  );
  const r = rows[0] as Record<string, unknown>;
  return {
    total: Number(r.total),
    open: Number(r.open),
    resolved: Number(r.resolved),
    inArbitration: Number(r.in_arbitration),
  };
}

async function loadSettlementStats(): Promise<SettlementStats> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT COUNT(*)::int as total,
        COALESCE(SUM(monetary_amount), 0)::numeric as total_value
      FROM settlements
    `)
  );
  const r = rows[0] as Record<string, unknown>;
  return {
    total: Number(r.total),
    totalMonetaryValue: Number(r.total_value),
  };
}

/* ── Helpers ── */
function formatSector(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Page ── */
export default async function SectorAnalyticsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const hasAccess = await hasMinRole('platform_lead');
  if (!hasAccess) redirect('/dashboard');

  const searchParams = await props.searchParams;
  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'overview';

  const [overview, orgs, sectors, cba, grievances, settlements] = await withSystemContext(() =>
    Promise.all([
      loadOverview(),
      loadOrganizations(),
      loadSectorBreakdown(),
      loadCbaStats(),
      loadGrievanceStats(),
      loadSettlementStats(),
    ])
  );

  const tabs = ['overview', 'sectors', 'organizations', 'bargaining'] as const;
  const tabLabels: Record<string, string> = {
    overview: 'Overview',
    sectors: 'Sector Breakdown',
    organizations: 'Organizations',
    bargaining: 'Bargaining & Settlements',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sector Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Industry-wide trends, wage data, and strategic intelligence across all sectors
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(t => (
          <Link
            key={t}
            href={`?tab=${t}`}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {tabLabels[t]}
          </Link>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Sectors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.sectorCount}</div>
                <p className="text-xs text-muted-foreground">{overview.totalOrgs} organizations total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalMembers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{overview.activeMembers} active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active CBAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{cba.active}</div>
                <p className="text-xs text-muted-foreground">{cba.total} total agreements</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Grievances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{grievances.open}</div>
                <p className="text-xs text-muted-foreground">{grievances.inArbitration} in arbitration</p>
              </CardContent>
            </Card>
          </div>

          {/* Sector cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sectors.length > 0 ? sectors.map(s => (
              <Card key={s.sector}>
                <CardHeader>
                  <CardTitle className="text-lg">{formatSector(s.sector)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organizations</span>
                    <span className="font-medium">{s.orgCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Members</span>
                    <span className="font-medium">{s.totalMembers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active Members</span>
                    <span className="font-medium">{s.activeMembers.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-3 border rounded-lg p-8 text-center">
                <p className="text-muted-foreground">No sector data available. Organizations need sectors assigned.</p>
              </div>
            )}
          </div>

          {/* Quick bargaining summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Collective Agreements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Total CBAs</span>
                  <span className="font-semibold">{cba.total}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Active</span>
                  <span className="font-semibold text-green-600">{cba.active}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Under Negotiation</span>
                  <span className="font-semibold text-blue-600">{cba.negotiating}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Expired</span>
                  <span className="font-semibold text-red-600">{cba.expired}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settlements & Grievances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Total Settlements</span>
                  <span className="font-semibold">{settlements.total}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Settlement Value</span>
                  <span className="font-semibold text-green-600">${settlements.totalMonetaryValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Grievances Resolved</span>
                  <span className="font-semibold text-green-600">{grievances.resolved}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Open Grievances</span>
                  <span className="font-semibold text-orange-600">{grievances.open}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Sectors Tab ── */}
      {tab === 'sectors' && (
        <div className="space-y-4">
          {sectors.length > 0 ? sectors.map(s => {
            const sectorOrgs = orgs.filter(o => o.sectors.includes(s.sector));
            return (
              <Card key={s.sector}>
                <CardHeader>
                  <CardTitle className="text-lg">{formatSector(s.sector)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4 mb-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold">{s.orgCount}</p>
                      <p className="text-xs text-muted-foreground">Organizations</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold">{s.totalMembers.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Members</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold">{s.activeMembers.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Active Members</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <p className="text-2xl font-bold">
                        {s.totalMembers > 0 ? Math.round((s.activeMembers / s.totalMembers) * 100) : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </div>
                  </div>
                  {sectorOrgs.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium">Organization</th>
                            <th className="pb-2 font-medium">Type</th>
                            <th className="pb-2 font-medium">Members</th>
                            <th className="pb-2 font-medium">CLC</th>
                            <th className="pb-2 font-medium">Tickets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectorOrgs.map(o => (
                            <tr key={o.id} className="border-b last:border-0">
                              <td className="py-2 font-medium">{o.name}</td>
                              <td className="py-2">
                                <Badge variant="outline">{o.organizationType}</Badge>
                              </td>
                              <td className="py-2">{o.memberCount}</td>
                              <td className="py-2">{o.clcAffiliated ? '✓' : '—'}</td>
                              <td className="py-2">{o.ticketCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No sectors found. Assign sectors to organizations to see breakdowns.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Organizations Tab ── */}
      {tab === 'organizations' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Organization</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Sectors</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Members</th>
                    <th className="pb-2 font-medium">Active</th>
                    <th className="pb-2 font-medium">CLC</th>
                    <th className="pb-2 font-medium">Logins (30d)</th>
                    <th className="pb-2 font-medium">Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{o.name}</td>
                      <td className="py-2">
                        <Badge variant="outline">{o.organizationType}</Badge>
                      </td>
                      <td className="py-2">
                        {o.sectors.length > 0
                          ? o.sectors.map(s => formatSector(s)).join(', ')
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2">
                        <Badge variant={o.status === 'active' ? 'default' : 'secondary'}>{o.status}</Badge>
                      </td>
                      <td className="py-2">{o.memberCount}</td>
                      <td className="py-2">{o.activeMemberCount}</td>
                      <td className="py-2">{o.clcAffiliated ? '✓' : '—'}</td>
                      <td className="py-2">{o.loginCount}</td>
                      <td className="py-2">{o.ticketCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bargaining & Settlements Tab ── */}
      {tab === 'bargaining' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total CBAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cba.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{cba.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Under Negotiation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{cba.negotiating}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{cba.expired}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Grievance Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Total Grievances</span>
                  <span className="font-bold">{grievances.total}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Open (Filed / Investigating / Escalated / Mediation)</span>
                  <span className="font-bold text-orange-600">{grievances.open}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>In Arbitration</span>
                  <span className="font-bold text-red-600">{grievances.inArbitration}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Resolved / Settled</span>
                  <span className="font-bold text-green-600">{grievances.resolved}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settlement Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Total Settlements</span>
                  <span className="font-bold">{settlements.total}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Total Monetary Value</span>
                  <span className="font-bold text-green-600">${settlements.totalMonetaryValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded text-sm">
                  <span>Avg. Settlement</span>
                  <span className="font-bold">
                    ${settlements.total > 0 ? Math.round(settlements.totalMonetaryValue / settlements.total).toLocaleString() : 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
