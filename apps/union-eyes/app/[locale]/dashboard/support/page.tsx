/**
 * Support Operations Dashboard
 * For Support Manager & Support Agents - Help desk operations
 *
 * @role support_manager, support_agent
 * @dashboard_path /dashboard/support
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import Link from 'next/link';
import {
  Headphones,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TicketIcon,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

/* ── Types ── */
interface OverviewStats {
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  totalTickets: number;
  openGrievances: number;
  highPriorityGrievances: number;
  inArbitration: number;
  resolvedGrievances: number;
  totalGrievances: number;
  totalSettlements: number;
  totalSettlementValue: number;
  avgResponseHours: number;
  avgResolutionHours: number;
  avgSatisfaction: number;
}

interface TicketRow {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  channel: string;
  submittedBy: string;
  assignedTo: string | null;
  orgName: string;
  createdAt: string;
  resolvedAt: string | null;
  satisfactionRating: number | null;
}

interface GrievanceRow {
  id: string;
  grievanceNumber: string;
  title: string;
  status: string;
  priority: string;
  orgName: string;
  createdAt: string;
  monetaryAmount: number | null;
  settlementStatus: string | null;
}

interface OrgBreakdown {
  orgName: string;
  openTickets: number;
  resolvedTickets: number;
  avgSatisfaction: number | null;
  openGrievances: number;
  resolvedGrievances: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
}

interface ChannelBreakdown {
  channel: string;
  count: number;
}

/* ── Data loaders ── */
async function loadOverview(): Promise<OverviewStats> {
  const [ticketStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tickets,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
        COUNT(*) as total_tickets,
        ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) FILTER (WHERE first_response_at IS NOT NULL), 1) as avg_response_hours,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL), 1) as avg_resolution_hours,
        ROUND(AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL), 1) as avg_satisfaction
      FROM support_tickets
    `)
  ).map((r: Record<string, unknown>) => r);

  const [grievanceStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('settled', 'withdrawn', 'denied', 'closed')) as open_grievances,
        COUNT(*) FILTER (WHERE priority IN ('high', 'urgent')) as high_priority,
        COUNT(*) FILTER (WHERE status = 'arbitration') as in_arbitration,
        COUNT(*) FILTER (WHERE status = 'settled') as resolved_grievances,
        COUNT(*) as total_grievances
      FROM grievances
    `)
  ).map((r: Record<string, unknown>) => r);

  const [settlementStats] = Array.from(
    await db.execute(sql`
      SELECT COUNT(*) as total, COALESCE(SUM(monetary_amount), 0) as total_value
      FROM settlements
    `)
  ).map((r: Record<string, unknown>) => r);

  return {
    openTickets: Number(ticketStats.open_tickets ?? 0),
    inProgressTickets: Number(ticketStats.in_progress_tickets ?? 0),
    resolvedTickets: Number(ticketStats.resolved_tickets ?? 0),
    totalTickets: Number(ticketStats.total_tickets ?? 0),
    openGrievances: Number(grievanceStats.open_grievances ?? 0),
    highPriorityGrievances: Number(grievanceStats.high_priority ?? 0),
    inArbitration: Number(grievanceStats.in_arbitration ?? 0),
    resolvedGrievances: Number(grievanceStats.resolved_grievances ?? 0),
    totalGrievances: Number(grievanceStats.total_grievances ?? 0),
    totalSettlements: Number(settlementStats.total ?? 0),
    totalSettlementValue: Number(settlementStats.total_value ?? 0),
    avgResponseHours: Number(ticketStats.avg_response_hours ?? 0),
    avgResolutionHours: Number(ticketStats.avg_resolution_hours ?? 0),
    avgSatisfaction: Number(ticketStats.avg_satisfaction ?? 0),
  };
}

async function loadTickets(statusFilter?: string): Promise<TicketRow[]> {
  const whereClause = statusFilter && statusFilter !== 'all'
    ? sql`WHERE t.status = ${statusFilter}`
    : sql``;

  const rows = Array.from(
    await db.execute(sql`
      SELECT t.id, t.ticket_number, t.subject, t.category, t.status, t.priority,
             t.channel, t.submitted_by, t.assigned_to, o.name as org_name,
             t.created_at::text, t.resolved_at::text, t.satisfaction_rating
      FROM support_tickets t
      JOIN organizations o ON o.id = t.organization_id
      ${whereClause}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.created_at DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    ticketNumber: String(r.ticket_number),
    subject: String(r.subject),
    category: String(r.category),
    status: String(r.status),
    priority: String(r.priority),
    channel: String(r.channel),
    submittedBy: String(r.submitted_by),
    assignedTo: r.assigned_to ? String(r.assigned_to) : null,
    orgName: String(r.org_name),
    createdAt: String(r.created_at),
    resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
    satisfactionRating: r.satisfaction_rating ? Number(r.satisfaction_rating) : null,
  }));
  return rows;
}

async function loadGrievances(): Promise<GrievanceRow[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT g.id, g.grievance_number, g.title, g.status, g.priority,
             o.name as org_name, g.created_at::text,
             s.monetary_amount, s.status as settlement_status
      FROM grievances g
      JOIN organizations o ON o.id = g.organization_id
      LEFT JOIN settlements s ON s.grievance_id = g.id
      ORDER BY
        CASE g.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        g.created_at DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    grievanceNumber: String(r.grievance_number),
    title: String(r.title),
    status: String(r.status),
    priority: String(r.priority),
    orgName: String(r.org_name),
    createdAt: String(r.created_at),
    monetaryAmount: r.monetary_amount ? Number(r.monetary_amount) : null,
    settlementStatus: r.settlement_status ? String(r.settlement_status) : null,
  }));
  return rows;
}

async function loadOrgBreakdown(): Promise<OrgBreakdown[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT
        o.name as org_name,
        COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in-progress')) as open_tickets,
        COUNT(t.id) FILTER (WHERE t.status = 'resolved') as resolved_tickets,
        ROUND(AVG(t.satisfaction_rating) FILTER (WHERE t.satisfaction_rating IS NOT NULL), 1) as avg_satisfaction,
        (SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.status NOT IN ('settled', 'withdrawn', 'denied', 'closed')) as open_grievances,
        (SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.status = 'settled') as resolved_grievances
      FROM organizations o
      LEFT JOIN support_tickets t ON t.organization_id = o.id
      WHERE o.organization_type NOT IN ('platform', 'congress')
      GROUP BY o.id, o.name
      ORDER BY open_tickets DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    orgName: String(r.org_name),
    openTickets: Number(r.open_tickets ?? 0),
    resolvedTickets: Number(r.resolved_tickets ?? 0),
    avgSatisfaction: r.avg_satisfaction ? Number(r.avg_satisfaction) : null,
    openGrievances: Number(r.open_grievances ?? 0),
    resolvedGrievances: Number(r.resolved_grievances ?? 0),
  }));
  return rows;
}

async function loadCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT category, COUNT(*) as count
      FROM support_tickets
      GROUP BY category
      ORDER BY count DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    category: String(r.category),
    count: Number(r.count),
  }));
  return rows;
}

async function loadChannelBreakdown(): Promise<ChannelBreakdown[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT channel, COUNT(*) as count
      FROM support_tickets
      GROUP BY channel
      ORDER BY count DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    channel: String(r.channel),
    count: Number(r.count),
  }));
  return rows;
}

/* ── Helpers ── */
function priorityVariant(p: string) {
  if (p === 'urgent') return 'destructive' as const;
  if (p === 'high') return 'destructive' as const;
  if (p === 'medium') return 'secondary' as const;
  return 'outline' as const;
}

function statusColor(s: string) {
  if (s === 'open') return 'text-yellow-600';
  if (s === 'in-progress') return 'text-blue-600';
  if (s === 'resolved' || s === 'settled') return 'text-green-600';
  return '';
}

function grievanceStatusVariant(s: string) {
  if (s === 'filed' || s === 'investigating') return 'secondary' as const;
  if (s === 'escalated' || s === 'mediation') return 'default' as const;
  if (s === 'arbitration') return 'destructive' as const;
  if (s === 'settled') return 'outline' as const;
  return 'outline' as const;
}

/* ── Page ── */
export default async function SupportDashboard({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: routeLocale } = await paramsPromise;
  const locale = await getLocale();
  const t = await getTranslations('supportPage');
  await requireUser();

  const hasAccess = await hasMinRole('support_agent');
  if (!hasAccess) {
    redirect(`/${routeLocale}/dashboard`);
  }

  const params = await searchParams;
  const tab = params.tab ?? 'overview';
  const ticketFilter = params.status ?? 'all';

  const [overview, tickets, grievances, orgBreakdown, categories, channels] =
    await withSystemContext(() =>
      Promise.all([
        loadOverview(),
        loadTickets(tab === 'tickets' ? ticketFilter : undefined),
        loadGrievances(),
        loadOrgBreakdown(),
        loadCategoryBreakdown(),
        loadChannelBreakdown(),
      ])
    );

  const tabs = [
    { key: 'overview', label: t('tabOverview'), icon: BarChart3 },
    { key: 'tickets', label: t('tabTickets'), icon: TicketIcon },
    { key: 'grievances', label: t('tabGrievances'), icon: AlertTriangle },
    { key: 'organizations', label: t('tabOrganizations'), icon: MessageSquare },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        ))}
      </div>

      {/* ───────── OVERVIEW TAB ───────── */}
      {tab === 'overview' && (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="?tab=tickets&status=open">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TicketIcon className="h-4 w-4" />
                    {t('openTicketsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.openTickets}</div>
                  <p className="text-xs text-muted-foreground">{t('inProgressLabel', { count: overview.inProgressTickets })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="?tab=grievances">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Headphones className="h-4 w-4" />
                    {t('activeCasesTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview.openGrievances}</div>
                  <p className="text-xs text-muted-foreground">{t('highPriorityLabel', { count: overview.highPriorityGrievances })}</p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('avgResponseTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.avgResponseHours}h</div>
                <p className="text-xs text-muted-foreground">{t('firstResponseLabel')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('satisfactionTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {overview.avgSatisfaction}/5
                </div>
                <p className="text-xs text-muted-foreground">{t('resolvedTicketsLabel', { count: overview.resolvedTickets })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline + breakdowns */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Grievance pipeline */}
            <Card>
              <CardHeader>
                <CardTitle>{t('grievancePipelineTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: t('pipelineHighPriority'), value: overview.highPriorityGrievances, variant: 'destructive' as const },
                    { label: t('pipelineOpen'), value: overview.openGrievances, variant: 'secondary' as const },
                    { label: t('pipelineArbitration'), value: overview.inArbitration, variant: 'outline' as const },
                    { label: t('pipelineResolved'), value: overview.resolvedGrievances, variant: 'default' as const, color: 'text-green-600' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.variant}>{item.label}</Badge>
                      </div>
                      <span className={`text-lg font-bold ${item.color ?? ''}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">{t('settlementsLabel')}</span>
                    <span className="text-lg font-bold">
                      {overview.totalSettlements}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({t('currencyAmount', { value: new Intl.NumberFormat(locale).format(overview.totalSettlementValue) })})
                      </span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket breakdown by category + channel */}
            <Card>
              <CardHeader>
                <CardTitle>{t('ticketBreakdownTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">{t('byCategoryTitle')}</p>
                  <div className="space-y-2">
                    {categories.map((c) => (
                      <div key={c.category} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{c.category.replace('-', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 bg-primary rounded-full"
                            style={{ width: `${(c.count / overview.totalTickets) * 120}px` }}
                          />
                          <span className="text-sm font-medium w-6 text-right">{c.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">{t('byChannelTitle')}</p>
                  <div className="flex gap-3">
                    {channels.map((ch) => (
                      <div key={ch.channel} className="text-center">
                        <div className="text-lg font-bold">{ch.count}</div>
                        <div className="text-xs text-muted-foreground capitalize">{ch.channel}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">{t('keyMetricsTitle')}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('avgResolutionMetric')}</span>
                      <div className="font-bold">{overview.avgResolutionHours}h</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('totalGrievancesMetric')}</span>
                      <div className="font-bold">{overview.totalGrievances}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ───────── TICKETS TAB ───────── */}
      {tab === 'tickets' && (
        <>
          {/* Status filter badges */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'open', 'in-progress', 'resolved'].map((s) => (
              <Link key={s} href={`?tab=tickets&status=${s}`}>
                <Badge
                  variant={ticketFilter === s ? 'default' : 'outline'}
                  className="cursor-pointer capitalize"
                >
                  {s === 'all' ? t('filterAll', { count: overview.totalTickets }) : s === 'in-progress' ? t('statusInProgress') : s === 'open' ? t('statusOpen') : t('statusResolved')}
                </Badge>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {t('supportTicketsTitle')}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {t('ticketsCount', { count: tickets.length })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">{t('tableNumber')}</th>
                      <th className="pb-2 font-medium">{t('tableSubject')}</th>
                      <th className="pb-2 font-medium">{t('tableOrganization')}</th>
                      <th className="pb-2 font-medium">{t('tableCategory')}</th>
                      <th className="pb-2 font-medium">{t('tablePriority')}</th>
                      <th className="pb-2 font-medium">{t('tableStatus')}</th>
                      <th className="pb-2 font-medium">{t('tableChannel')}</th>
                      <th className="pb-2 font-medium">{t('tableAssigned')}</th>
                      <th className="pb-2 font-medium">{t('tableRating')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{ticket.ticketNumber}</td>
                        <td className="py-2 max-w-62.5 truncate">{ticket.subject}</td>
                        <td className="py-2">{ticket.orgName}</td>
                        <td className="py-2 capitalize">{ticket.category.replace('-', ' ')}</td>
                        <td className="py-2">
                          <Badge variant={priorityVariant(ticket.priority)} className="capitalize">
                            {ticket.priority}
                          </Badge>
                        </td>
                        <td className={`py-2 capitalize font-medium ${statusColor(ticket.status)}`}>
                          {ticket.status === 'in-progress' ? t('statusInProgress') : ticket.status === 'open' ? t('statusOpen') : ticket.status === 'resolved' ? t('statusResolved') : ticket.status.replace('-', ' ')}
                        </td>
                        <td className="py-2 capitalize">{ticket.channel}</td>
                        <td className="py-2">{ticket.assignedTo ?? t('emptyDash')}</td>
                        <td className="py-2">
                          {ticket.satisfactionRating ? `${ticket.satisfactionRating}/5` : t('emptyDash')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ───────── GRIEVANCES TAB ───────── */}
      {tab === 'grievances' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('grievancePipelineTitle')}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {t('grievancesCount', { count: grievances.length })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">{t('tableNumber')}</th>
                    <th className="pb-2 font-medium">{t('tableTitle')}</th>
                    <th className="pb-2 font-medium">{t('tableOrganization')}</th>
                    <th className="pb-2 font-medium">{t('tablePriority')}</th>
                    <th className="pb-2 font-medium">{t('tableStatus')}</th>
                    <th className="pb-2 font-medium">{t('tableSettlement')}</th>
                    <th className="pb-2 font-medium">{t('tableFiled')}</th>
                  </tr>
                </thead>
                <tbody>
                  {grievances.map((g) => (
                    <tr key={g.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{g.grievanceNumber}</td>
                      <td className="py-2 max-w-75 truncate">{g.title}</td>
                      <td className="py-2">{g.orgName}</td>
                      <td className="py-2">
                        <Badge variant={priorityVariant(g.priority)} className="capitalize">
                          {g.priority}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant={grievanceStatusVariant(g.status)} className="capitalize">
                          {g.status}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {g.monetaryAmount
                          ? t('settlementValue', { value: new Intl.NumberFormat(locale).format(g.monetaryAmount), status: g.settlementStatus ?? '' })
                          : t('emptyDash')}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(g.createdAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── ORGANIZATIONS TAB ───────── */}
      {tab === 'organizations' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('supportByOrganizationTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">{t('tableOrganization')}</th>
                    <th className="pb-2 font-medium text-right">{t('tableOpenTickets')}</th>
                    <th className="pb-2 font-medium text-right">{t('tableResolvedTickets')}</th>
                    <th className="pb-2 font-medium text-right">{t('tableSatisfaction')}</th>
                    <th className="pb-2 font-medium text-right">{t('tableActiveCases')}</th>
                    <th className="pb-2 font-medium text-right">{t('tableResolvedGrievances')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orgBreakdown.map((o) => (
                    <tr key={o.orgName} className="border-b last:border-0">
                      <td className="py-2 font-medium">{o.orgName}</td>
                      <td className="py-2 text-right">{o.openTickets}</td>
                      <td className="py-2 text-right text-green-600">{o.resolvedTickets}</td>
                      <td className="py-2 text-right">
                        {o.avgSatisfaction ? `${o.avgSatisfaction}/5` : t('emptyDash')}
                      </td>
                      <td className="py-2 text-right">{o.openGrievances}</td>
                      <td className="py-2 text-right text-green-600">{o.resolvedGrievances}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
