/**
 * What the customer success dashboard reads: platform-wide figures across every organization.
 *
 * Cross-organization by design, so these loaders run on the system role: the dashboard page admits only platform staff (isSystemAdmin) and then
 * calls them inside withSystemContext. They use the module-level handle, which inside that context is the system transaction. The system role needs
 * SELECT on organizations, grievances, collective_agreements, support_tickets, customer_nps_surveys and customer_onboarding_milestones. It has none on
 * settlements, and a platform-wide settlement figure is not something platform staff need, so none is read (see lib/queries/platform-stats.ts).
 */
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export interface OverviewStats {
  totalOrgs: number;
  activeOrgs: number;
  totalMembers: number;
  activeMembers: number;
  openGrievances: number;
  resolvedGrievances: number;
  totalGrievances: number;
  totalCBAs: number;
  activeCBAs: number;
  expiredCBAs: number;
  negotiatingCBAs: number;
  openTickets: number;
  avgSatisfaction: number;
  npsScore: number;
  totalNpsSurveys: number;
}

export interface OrgHealth {
  id: string;
  name: string;
  orgType: string;
  status: string;
  memberCount: number;
  activeMemberCount: number;
  clcAffiliated: boolean;
  openTickets: number;
  avgTicketSatisfaction: number | null;
  openGrievances: number;
  resolvedGrievances: number;
  totalCBAs: number;
  npsAvg: number | null;
  healthScore: number;
}

export interface OnboardingRow {
  orgName: string;
  milestone: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
}

export interface NpsSurvey {
  respondentName: string;
  orgName: string;
  score: number;
  feedback: string | null;
  category: string | null;
  submittedAt: string;
}

// A ticket is open until it is resolved, closed or cancelled (ticket_status also has in_progress, waiting_customer and waiting_internal).
const OPEN_TICKET = sql`NOT IN ('resolved', 'closed', 'cancelled')`;

export async function loadOverview(): Promise<OverviewStats> {
  const [orgStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total_orgs,
        COUNT(*) FILTER (WHERE status = 'active') as active_orgs,
        COALESCE(SUM(member_count), 0) as total_members,
        COALESCE(SUM(active_member_count), 0) as active_members
      FROM organizations WHERE organization_type NOT IN ('platform', 'congress')
    `)
  ).map((r: Record<string, unknown>) => r);

  const [grievanceStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status NOT IN ('settled', 'withdrawn', 'denied', 'closed')) as open,
        COUNT(*) FILTER (WHERE status = 'settled') as resolved
      FROM grievances
      WHERE demo_seed_id IS NULL
    `)
  ).map((r: Record<string, unknown>) => r);

  const [cbaStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'under_negotiation') as negotiating
      FROM collective_agreements
    `)
  ).map((r: Record<string, unknown>) => r);

  const [ticketStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status ${OPEN_TICKET}) as open_tickets,
        ROUND(AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL), 1) as avg_satisfaction
      FROM support_tickets
    `)
  ).map((r: Record<string, unknown>) => r);

  const [npsStats] = Array.from(
    await db.execute(sql`
      SELECT
        COUNT(*) as total_surveys,
        ROUND(
          (COUNT(*) FILTER (WHERE score >= 9)::numeric - COUNT(*) FILTER (WHERE score <= 6)::numeric)
          / NULLIF(COUNT(*), 0) * 100
        , 0) as nps_score
      FROM customer_nps_surveys
    `)
  ).map((r: Record<string, unknown>) => r);

  return {
    totalOrgs: Number(orgStats.total_orgs ?? 0),
    activeOrgs: Number(orgStats.active_orgs ?? 0),
    totalMembers: Number(orgStats.total_members ?? 0),
    activeMembers: Number(orgStats.active_members ?? 0),
    openGrievances: Number(grievanceStats.open ?? 0),
    resolvedGrievances: Number(grievanceStats.resolved ?? 0),
    totalGrievances: Number(grievanceStats.total ?? 0),
    totalCBAs: Number(cbaStats.total ?? 0),
    activeCBAs: Number(cbaStats.active ?? 0),
    expiredCBAs: Number(cbaStats.expired ?? 0),
    negotiatingCBAs: Number(cbaStats.negotiating ?? 0),
    openTickets: Number(ticketStats.open_tickets ?? 0),
    avgSatisfaction: Number(ticketStats.avg_satisfaction ?? 0),
    npsScore: Number(npsStats.nps_score ?? 0),
    totalNpsSurveys: Number(npsStats.total_surveys ?? 0),
  };
}

export async function loadOrgHealth(): Promise<OrgHealth[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT
        o.id, o.name, o.organization_type as org_type, o.status,
        o.member_count, o.active_member_count, o.clc_affiliated,
        COALESCE((SELECT COUNT(*) FROM support_tickets st WHERE st.organization_id = o.id AND st.status ${OPEN_TICKET}), 0) as open_tickets,
        (SELECT ROUND(AVG(st.satisfaction_rating), 1) FROM support_tickets st WHERE st.organization_id = o.id AND st.satisfaction_rating IS NOT NULL) as avg_ticket_satisfaction,
        COALESCE((SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.demo_seed_id IS NULL AND g.status NOT IN ('settled', 'withdrawn', 'denied', 'closed')), 0) as open_grievances,
        COALESCE((SELECT COUNT(*) FROM grievances g WHERE g.organization_id = o.id AND g.demo_seed_id IS NULL AND g.status = 'settled'), 0) as resolved_grievances,
        COALESCE((SELECT COUNT(*) FROM collective_agreements ca WHERE ca.organization_id = o.id), 0) as total_cbas,
        (SELECT ROUND(AVG(n.score), 1) FROM customer_nps_surveys n WHERE n.organization_id = o.id) as nps_avg
      FROM organizations o
      WHERE o.organization_type NOT IN ('platform', 'congress')
      ORDER BY o.name
    `)
  ).map((r: Record<string, unknown>) => {
    const memberCount = Number(r.member_count ?? 0);
    const activeMemberCount = Number(r.active_member_count ?? 0);
    const clcAffiliated = Boolean(r.clc_affiliated);
    const openGrievances = Number(r.open_grievances ?? 0);
    const npsAvg = r.nps_avg ? Number(r.nps_avg) : null;

    // Points are awarded for the signals that are recorded: base 40, status 10, active members 10, NPS up to 10, CLC affiliation 5, no open grievances 5. Usage telemetry is
    // not collected, so it is not part of the score, and the total is taken out of the points that can be earned (80) so that 100% still means every recorded signal is good.
    const MAX_RECORDED_POINTS = 80;
    let health = 40;
    if (String(r.status) === 'active') health += 10;
    if (activeMemberCount > 0) health += 10;
    if (npsAvg && npsAvg >= 8) health += 10;
    else if (npsAvg && npsAvg >= 6) health += 5;
    if (clcAffiliated) health += 5;
    if (openGrievances === 0) health += 5;
    health = Math.round((health / MAX_RECORDED_POINTS) * 100);

    return {
      id: String(r.id),
      name: String(r.name),
      orgType: String(r.org_type),
      status: String(r.status),
      memberCount,
      activeMemberCount,
      clcAffiliated,
      openTickets: Number(r.open_tickets ?? 0),
      avgTicketSatisfaction: r.avg_ticket_satisfaction ? Number(r.avg_ticket_satisfaction) : null,
      openGrievances,
      resolvedGrievances: Number(r.resolved_grievances ?? 0),
      totalCBAs: Number(r.total_cbas ?? 0),
      npsAvg,
      healthScore: health,
    };
  });
  return rows;
}

export async function loadOnboarding(): Promise<OnboardingRow[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT o.name as org_name, m.milestone, m.status, m.completed_at::text, m.notes
      FROM customer_onboarding_milestones m
      JOIN organizations o ON o.id = m.organization_id
      ORDER BY o.name, m.created_at
    `)
  ).map((r: Record<string, unknown>) => ({
    orgName: String(r.org_name),
    milestone: String(r.milestone),
    status: String(r.status),
    completedAt: r.completed_at ? String(r.completed_at) : null,
    notes: r.notes ? String(r.notes) : null,
  }));
  return rows;
}

export async function loadNpsSurveys(): Promise<NpsSurvey[]> {
  const rows = Array.from(
    await db.execute(sql`
      SELECT n.respondent_name, o.name as org_name, n.score, n.feedback, n.category, n.submitted_at::text
      FROM customer_nps_surveys n
      JOIN organizations o ON o.id = n.organization_id
      ORDER BY n.submitted_at DESC
    `)
  ).map((r: Record<string, unknown>) => ({
    respondentName: String(r.respondent_name),
    orgName: String(r.org_name),
    score: Number(r.score),
    feedback: r.feedback ? String(r.feedback) : null,
    category: r.category ? String(r.category) : null,
    submittedAt: String(r.submitted_at),
  }));
  return rows;
}
