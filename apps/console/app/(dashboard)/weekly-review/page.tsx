import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  executionInitiatives,
  itsmTickets,
  opsClients,
  productHealthSnapshots,
} from '@nzila/db/schema'
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import {
  getTopExecutionActions,
  getWeeklyBriefingData,
  getRunwayData,
} from '@/lib/executive-intelligence'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { WeeklyReviewClient, type WeeklyReviewData } from './weekly-review-client'

export const dynamic = 'force-dynamic'

async function loadWeeklyReviewData(): Promise<WeeklyReviewData> {
  const orgId = await getExecutiveOrgId()

  const [topActions, briefing, runway, urgentBlockers, p1p2Open, atRiskCount, atRiskClients, unassignedHighTickets, productRows] = await Promise.all([
    getTopExecutionActions(5),
    getWeeklyBriefingData(),
    getRunwayData(),
    orgId
      ? platformDb
          .select({ count: sql<number>`count(*)::int` })
          .from(executionInitiatives)
          .where(and(eq(executionInitiatives.orgId, orgId), eq(executionInitiatives.urgent, true), ne(executionInitiatives.status, 'done')))
          .then((rows) => rows[0]?.count ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
    orgId
      ? platformDb
          .select({ count: sql<number>`count(*)::int` })
          .from(itsmTickets)
          .where(
            and(
              eq(itsmTickets.orgId, orgId),
              ne(itsmTickets.status, 'resolved'),
              ne(itsmTickets.status, 'closed'),
              inArray(itsmTickets.priority, ['p1_critical', 'p2_high']),
            ),
          )
          .then((rows) => rows[0]?.count ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
    orgId
      ? platformDb
          .select({ count: sql<number>`count(*)::int` })
          .from(opsClients)
          .where(and(eq(opsClients.orgId, orgId), inArray(opsClients.health, ['at_risk', 'needs_attention'])))
          .then((rows) => rows[0]?.count ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
    orgId
      ? platformDb
          .select({
            id: opsClients.id,
            companyName: opsClients.companyName,
            product: opsClients.product,
            renewalDate: opsClients.renewalDate,
            health: opsClients.health,
            healthScore: opsClients.healthScore,
          })
          .from(opsClients)
          .where(and(eq(opsClients.orgId, orgId), inArray(opsClients.health, ['at_risk', 'needs_attention'])))
          .orderBy(asc(opsClients.healthScore), asc(opsClients.renewalDate))
          .limit(5)
          .catch(() => [])
      : Promise.resolve([]),
    orgId
      ? platformDb
          .select({
            id: itsmTickets.id,
            ticketNumber: itsmTickets.ticketNumber,
            title: itsmTickets.title,
            priority: itsmTickets.priority,
            assignedToId: itsmTickets.assignedToId,
          })
          .from(itsmTickets)
          .where(
            and(
              eq(itsmTickets.orgId, orgId),
              ne(itsmTickets.status, 'resolved'),
              ne(itsmTickets.status, 'closed'),
              inArray(itsmTickets.priority, ['p1_critical', 'p2_high']),
              sql`${itsmTickets.assignedToId} is null`,
            ),
          )
          .orderBy(desc(itsmTickets.createdAt))
          .limit(3)
          .catch(() => [])
      : Promise.resolve([]),
    orgId
      ? platformDb
          .select({
            product: productHealthSnapshots.product,
            incidentsThisMonth: productHealthSnapshots.incidentsThisMonth,
            supportLoad: productHealthSnapshots.supportLoad,
            deploymentsShipped: productHealthSnapshots.deploymentsShipped,
            openBugs: productHealthSnapshots.openBugs,
            createdAt: productHealthSnapshots.createdAt,
          })
          .from(productHealthSnapshots)
          .where(eq(productHealthSnapshots.orgId, orgId))
          .orderBy(desc(productHealthSnapshots.createdAt))
          .limit(50)
          .catch(() => [])
      : Promise.resolve([]),
  ])

  const dailyItems: WeeklyReviewData['daily']['items'] = [
    ...unassignedHighTickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      type: 'blocker' as const,
      label: `${ticket.ticketNumber}: ${ticket.title}`,
      detail: `${ticket.priority.replace(/_/g, ' ')} ticket has no assigned owner.`,
      href: `/itsm/tickets/${ticket.id}`,
    })),
    ...atRiskClients.slice(0, 2).map((client) => ({
      id: `client-${client.id}`,
      type: client.health === 'at_risk' ? 'urgent' as const : 'priority' as const,
      label: `${client.companyName} needs account attention`,
      detail: `${client.product.replace(/_/g, ' ')} · renewal ${client.renewalDate ?? 'not set'} · health ${client.healthScore ?? 100}`,
      href: `/itsm/clients/${client.id}`,
    })),
    ...topActions.map((action) => ({
      id: `action-${action.id}`,
      type: action.urgent ? 'urgent' as const : 'priority' as const,
      label: action.action,
      detail: `${action.zone}${action.dueDate ? ` · due ${action.dueDate.toISOString().slice(0, 10)}` : ''}`,
      href: '/execution',
    })),
  ].slice(0, 6)

  const latestProducts = new Map<string, { incidentsThisMonth: number; supportLoad: number; deploymentsShipped: number; openBugs: number }>()
  for (const row of productRows) {
    if (!latestProducts.has(row.product)) {
      latestProducts.set(row.product, {
        incidentsThisMonth: row.incidentsThisMonth,
        supportLoad: row.supportLoad,
        deploymentsShipped: row.deploymentsShipped,
        openBugs: row.openBugs,
      })
    }
  }

  const productHealth = Array.from(latestProducts.entries()).slice(0, 4).map(([product, metrics]) => ({
    product,
    incidentsThisMonth: metrics.incidentsThisMonth,
    supportLoad: metrics.supportLoad,
    deploymentsShipped: metrics.deploymentsShipped,
    openBugs: metrics.openBugs,
  }))

  const baseRunway = runway.scenarioRows.find((row) => row.mode === 'base') ?? runway.scenarioRows[0] ?? null

  return {
    daily: {
      items: dailyItems,
      p1p2Open,
      atRiskClients: atRiskCount,
      hardBlockers: urgentBlockers + unassignedHighTickets.length,
    },
    weekly: {
      summary: briefing.summarySentence,
      decisionCandidates: briefing.decisionCandidates.slice(0, 4).map((candidate) => ({
        title: candidate.title,
        detail: `${candidate.category} · ${candidate.owner} · due in ${candidate.dueDays}d`,
        priority: candidate.priority,
      })),
      pipelineMovements: briefing.dealsNeedingFounderAction.slice(0, 4).map((deal) => ({
        action: deal.ref,
        detail: `${deal.status} · ${deal.ageDays}d old · $${deal.valueUsd.toFixed(0)}`,
        positive: deal.status === 'accepted',
      })),
      churnRiskClients: atRiskClients.slice(0, 3).map((client) => ({
        name: client.companyName,
        product: client.product,
        renewal: client.renewalDate ?? 'not set',
        score: client.healthScore ?? 100,
      })),
      productHealth,
      risksRising: briefing.risksRising.slice(0, 4),
    },
    monthly: {
      metrics: [
        { label: 'Base runway', value: baseRunway ? `${baseRunway.runwayMonths.toFixed(1)} mo` : '—', note: 'Current base-case scenario' },
        { label: 'Net working capital', value: `$${runway.netWorkingCapitalUsd.toFixed(0)}`, note: 'Cash + receivables - liabilities' },
        { label: 'Top venture', value: briefing.topVenture?.ventureName.replace(/-/g, ' ') ?? '—', delta: briefing.topVenture?.action, note: 'Highest current capital priority' },
        { label: 'Lowest venture', value: briefing.lowestVenture?.ventureName.replace(/-/g, ' ') ?? '—', delta: briefing.lowestVenture?.action, note: 'Needs review before more spend' },
        { label: 'Founder-action deals', value: String(briefing.dealsNeedingFounderAction.length), note: 'Quotes needing escalation this month' },
        { label: 'Rising risks', value: String(briefing.risksRising.length), note: 'Cross-domain warnings open' },
      ],
      wins: briefing.improved.length > 0 ? briefing.improved : ['No positive movement recorded yet this period.'],
      risks: briefing.worsened.length > 0 ? briefing.worsened : (briefing.risksRising.length > 0 ? briefing.risksRising : ['No material board-level risks detected.']),
      roadmapSignals: productHealth,
    },
  }
}

export default async function WeeklyReviewPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await loadWeeklyReviewData()
  return <WeeklyReviewClient data={data} />
}
