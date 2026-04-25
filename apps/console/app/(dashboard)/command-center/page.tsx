import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  BoltIcon,
  ArrowRightIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  ONBOARDING_STAGE_LABELS,
  CLIENT_HEALTH_LABELS,
  ALERT_TYPE_LABELS,
} from '@nzila/itsm-core'
import { platformDb } from '@nzila/db/platform'
import {
  commandAlerts,
  founderPriorities,
  itsmTickets,
  opsClients,
  productHealthSnapshots,
} from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import type {
  NzilaProduct,
  OnboardingStage,
  ClientHealth,
  AlertType,
  AlertSeverity,
  FounderPriorityType,
} from '@nzila/itsm-core'
import { CommandPageShell } from '@/components/command-page-shell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Command Center — Nzila OS',
}

// ── View models ───────────────────────────────────────────────────────────────

type ClientRow = {
  id: string
  companyName: string
  product: NzilaProduct
  health: ClientHealth
  healthScore: number
  openTickets: number
  onboardingStage: OnboardingStage
  contractValue: string | null
  renewalDate: string | null
}

type AlertRow = {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  body: string | null
  clientId: string | null
  productKey: string | null
}

type ProductHealth = {
  product: NzilaProduct
  label: string
  incidentsThisMonth: number
  supportLoad: number
  deploymentsShipped: number
  openBugs: number
}

type PriorityRow = {
  id: string
  title: string
  type: FounderPriorityType
  dueDate: string | null
  done: boolean
  linkedEntityType: string | null
}

type TeamMember = {
  name: string
  openTickets: number
  overdueTickets: number
  status: 'overloaded' | 'normal' | 'idle'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthColor(health: ClientHealth): string {
  return {
    healthy: 'bg-emerald-500',
    needs_attention: 'bg-amber-500',
    at_risk: 'bg-orange-500',
    churned: 'bg-red-600',
  }[health]
}

function healthBorder(health: ClientHealth): string {
  return {
    healthy: 'border-emerald-500/30',
    needs_attention: 'border-amber-500/30',
    at_risk: 'border-orange-500/30',
    churned: 'border-red-600/30',
  }[health]
}

function severityBg(severity: AlertSeverity): string {
  return {
    critical: 'bg-red-950/60 border-red-700',
    high: 'bg-orange-950/60 border-orange-700',
    medium: 'bg-amber-950/60 border-amber-600',
  }[severity]
}

function severityDot(severity: AlertSeverity): string {
  return { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-400' }[severity]
}

function priorityTypeIcon(type: FounderPriorityType): string {
  return { renewal: '🔄', incident: '🔥', proposal: '📋', risk: '⚠️', ops: '⚙️' }[type]
}

function productLabel(product: NzilaProduct): string {
  return {
    union_eyes: 'Union Eyes',
    faircase: 'FairCase',
    flow: 'Flow',
    zonga: 'Zonga',
    agrimo: 'Agrimo',
    platform: 'Platform',
    other: 'Other',
  }[product]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CommandCenterPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const orgId = await getExecutiveOrgId()

  let clientList: ClientRow[] = []
  let alertList: AlertRow[] = []
  let productList: ProductHealth[] = []
  let priorityList: PriorityRow[] = []
  let teamList: TeamMember[] = []

  if (orgId) {
    const [clientRows, alertRows, productRows, priorityRows, teamRows] = await Promise.all([
      platformDb
        .select({
          id: opsClients.id,
          companyName: opsClients.companyName,
          product: opsClients.product,
          health: opsClients.health,
          healthScore: opsClients.healthScore,
          openTickets: opsClients.openTickets,
          onboardingStage: opsClients.onboardingStage,
          contractValue: opsClients.contractValue,
          renewalDate: opsClients.renewalDate,
        })
        .from(opsClients)
        .where(eq(opsClients.orgId, orgId))
        .orderBy(desc(opsClients.updatedAt))
        .limit(100)
        .catch(() => []),
      platformDb
        .select({
          id: commandAlerts.id,
          type: commandAlerts.type,
          severity: commandAlerts.severity,
          title: commandAlerts.title,
          body: commandAlerts.body,
          clientId: commandAlerts.clientId,
          productKey: commandAlerts.productKey,
        })
        .from(commandAlerts)
        .where(and(eq(commandAlerts.orgId, orgId), isNull(commandAlerts.resolvedAt)))
        .orderBy(desc(commandAlerts.createdAt))
        .limit(50)
        .catch(() => []),
      platformDb
        .select({
          id: productHealthSnapshots.id,
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
        .limit(300)
        .catch(() => []),
      platformDb
        .select({
          id: founderPriorities.id,
          title: founderPriorities.title,
          type: founderPriorities.type,
          dueDate: founderPriorities.dueDate,
          done: founderPriorities.done,
          linkedEntityType: founderPriorities.linkedEntityType,
        })
        .from(founderPriorities)
        .where(eq(founderPriorities.orgId, orgId))
        .orderBy(desc(founderPriorities.createdAt))
        .limit(100)
        .catch(() => []),
      platformDb
        .select({
          assignee: itsmTickets.assignedToId,
          openCount: sql<number>`count(*)::int`,
          overdueCount: sql<number>`count(*) filter (where ${itsmTickets.slaResolutionDue}::timestamptz < now())::int`,
        })
        .from(itsmTickets)
        .where(and(eq(itsmTickets.orgId, orgId), ne(itsmTickets.status, 'resolved'), ne(itsmTickets.status, 'closed')))
        .groupBy(itsmTickets.assignedToId)
        .orderBy(sql`count(*) desc`)
        .limit(12)
        .catch(() => []),
    ])

    clientList = clientRows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      product: (row.product || 'other') as NzilaProduct,
      health: row.health as ClientHealth,
      healthScore: row.healthScore ?? 100,
      openTickets: row.openTickets ?? 0,
      onboardingStage: row.onboardingStage as OnboardingStage,
      contractValue: row.contractValue,
      renewalDate: row.renewalDate,
    }))

    alertList = alertRows.map((row) => ({
      id: row.id,
      type: row.type as AlertType,
      severity: row.severity as AlertSeverity,
      title: row.title,
      body: row.body,
      clientId: row.clientId,
      productKey: row.productKey,
    }))

    const latestByProduct = new Map<string, { incidentsThisMonth: number; supportLoad: number; deploymentsShipped: number; openBugs: number }>()
    for (const row of productRows) {
      if (!latestByProduct.has(row.product)) {
        latestByProduct.set(row.product, {
          incidentsThisMonth: row.incidentsThisMonth,
          supportLoad: row.supportLoad,
          deploymentsShipped: row.deploymentsShipped,
          openBugs: row.openBugs,
        })
      }
    }
    productList = Array.from(latestByProduct.entries()).map(([product, metrics]) => ({
      product: product as NzilaProduct,
      label: productLabel(product as NzilaProduct),
      incidentsThisMonth: metrics.incidentsThisMonth,
      supportLoad: metrics.supportLoad,
      deploymentsShipped: metrics.deploymentsShipped,
      openBugs: metrics.openBugs,
    }))

    priorityList = priorityRows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type as FounderPriorityType,
      dueDate: row.dueDate,
      done: row.done,
      linkedEntityType: row.linkedEntityType,
    }))

    teamList = teamRows.map((row) => {
      const openTickets = row.openCount ?? 0
      return {
        name: row.assignee || 'Unassigned',
        openTickets,
        overdueTickets: row.overdueCount ?? 0,
        status: openTickets >= 10 ? 'overloaded' : openTickets <= 1 ? 'idle' : 'normal',
      }
    })
  }

  // Aggregate metrics
  const totalClients = clientList.length
  const liveClients = clientList.filter(c => c.onboardingStage === 'live').length
  const atRiskClients = clientList.filter(c => c.health === 'at_risk' || c.health === 'churned').length
  const totalContractValue = clientList.reduce((sum, c) => sum + parseInt(c.contractValue ?? '0', 10), 0)
  // eslint-disable-next-line react-hooks/purity -- server component, Date.now() safe per-request
  const nowMs = Date.now()
  const renewalNext90 = clientList.filter(c => {
    if (!c.renewalDate) return false
    const days = (new Date(c.renewalDate).getTime() - nowMs) / 86_400_000
    return days >= 0 && days <= 90
  }).length
  const criticalAlerts = alertList.filter(a => a.severity === 'critical').length
  const totalOpenTickets = clientList.reduce((sum, c) => sum + c.openTickets, 0)

  return (
    <CommandPageShell className="space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Command Center</h1>
          <p className="text-sm text-slate-300 mt-0.5">
            Running Nzila like a R25M ARR company before it is one — every metric tied to a decision.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/weekly-review"
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Weekly Review
          </Link>
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors"
          >
            <ChartBarIcon className="h-4 w-4" />
            Portfolio Allocation
          </Link>
        </div>
      </div>

      {/* ── Section A: Revenue Pulse ───────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Revenue Pulse
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Active Clients</p>
            <p className="text-2xl font-bold text-white">{totalClients}</p>
            <p className="text-xs text-slate-300 mt-1">{liveClients} live</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">ARR Proxy</p>
            <p className="text-2xl font-bold text-white">
              R{(totalContractValue / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-0.5">
              <ArrowTrendingUpIcon className="h-3 w-3" /> Annual
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">MRR Proxy</p>
            <p className="text-2xl font-bold text-white">
              R{(totalContractValue / 12 / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-slate-300 mt-1">Avg across clients</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Renewals (90d)</p>
            <p className="text-2xl font-bold text-white">{renewalNext90}</p>
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-0.5">
              <ClockIcon className="h-3 w-3" /> Upcoming
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Churn Risk</p>
            <p className={`text-2xl font-bold ${atRiskClients > 0 ? 'text-red-400' : 'text-white'}`}>
              {atRiskClients}
            </p>
            <p className="text-xs text-slate-300 mt-1">at_risk + churned</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Open Tickets</p>
            <p className="text-2xl font-bold text-white">{totalOpenTickets}</p>
            <Link href="/itsm/queue" className="text-xs text-blue-400 mt-1 flex items-center gap-0.5 hover:text-blue-300">
              View queue <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section B: Smart Alerts ───────────────────────────────────────── */}
      {alertList.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Smart Alerts
              {criticalAlerts > 0 && (
                <span className="ml-2 inline-flex items-center bg-red-900/60 text-red-300 text-xs px-1.5 py-0.5 rounded">
                  {criticalAlerts} critical
                </span>
              )}
            </h2>
            <Link href="/itsm/dashboard" className="text-xs text-slate-300 hover:text-white flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {alertList.map(alert => (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 ${severityBg(alert.severity)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full ${severityDot(alert.severity)}`} />
                  <span className="text-xs font-medium text-slate-200">
                    {ALERT_TYPE_LABELS[alert.type]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">{alert.title}</p>
                {alert.body && (
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{alert.body}</p>
                )}
                {alert.clientId && (
                  <Link
                    href={`/itsm/clients/${alert.clientId}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    View account <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section C: Client Health Grid ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Client Health Grid
          </h2>
          <Link href="/itsm/clients" className="text-xs text-slate-300 hover:text-white flex items-center gap-1">
            All accounts <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {clientList.map(client => (
            <Link
              key={client.id}
              href={`/itsm/clients/${client.id}`}
              className={`block bg-slate-900 border ${healthBorder(client.health)} rounded-lg p-4 hover:border-slate-600 transition-colors`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white leading-snug">{client.companyName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{productLabel(client.product)}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full mt-0.5 ${healthColor(client.health)}`} />
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  {CLIENT_HEALTH_LABELS[client.health]}
                </span>
                <span className="text-xs font-medium text-slate-300">
                  {client.healthScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-slate-500">
                  {ONBOARDING_STAGE_LABELS[client.onboardingStage]}
                </span>
                {client.openTickets > 0 && (
                  <span className={`text-xs font-medium ${client.openTickets >= 4 ? 'text-red-400' : 'text-amber-400'}`}>
                    {client.openTickets} tickets
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ── Section D: Product Health ──────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Product Health
          </h2>
          <div className="space-y-2">
            {productList.map(p => {
              const isRed = p.incidentsThisMonth >= 3 || p.openBugs >= 5
              const isAmber = !isRed && (p.incidentsThisMonth >= 1 || p.supportLoad >= 4)
              const color = isRed ? 'text-red-400' : isAmber ? 'text-amber-400' : 'text-emerald-400'
              return (
                <div key={p.product} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${color}`}>●</span>
                      <span className="text-sm font-medium text-white">{p.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span title="Incidents this month">
                        <ExclamationTriangleIcon className="h-3 w-3 inline mr-0.5" />
                        {p.incidentsThisMonth}
                      </span>
                      <span title="Support tickets">
                        <UsersIcon className="h-3 w-3 inline mr-0.5" />
                        {p.supportLoad}
                      </span>
                      <span title="Deployments shipped" className="text-emerald-400">
                        <BoltIcon className="h-3 w-3 inline mr-0.5" />
                        {p.deploymentsShipped}
                      </span>
                      <span title="Open bugs" className={p.openBugs >= 5 ? 'text-red-400' : ''}>
                        <ShieldExclamationIcon className="h-3 w-3 inline mr-0.5" />
                        {p.openBugs}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            ● Incidents · Tickets · Deploys · Bugs (this month)
          </p>
        </section>

        {/* ── Section E: Founder Priorities ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Priorities Today
            </h2>
            <span className="text-xs text-slate-600">
              {priorityList.filter(p => !p.done).length} open
            </span>
          </div>
          <div className="space-y-2">
            {priorityList.filter(p => !p.done).map(item => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-start gap-3"
              >
                <span className="text-base mt-0.5">{priorityTypeIcon(item.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-snug">{item.title}</p>
                  {item.dueDate && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      Due {item.dueDate}
                    </p>
                  )}
                </div>
                {item.linkedEntityType === 'client' && item.id && (
                  <Link href="/itsm/clients" className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
            {priorityList.filter(p => !p.done).length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                <CheckCircleIcon className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-sm text-slate-400">All priorities cleared.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Section F: Team Load ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Team Load
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamList.map(member => {
            const statusColor =
              member.status === 'overloaded'
                ? 'border-red-700 bg-red-950/40'
                : member.status === 'idle'
                ? 'border-slate-600 bg-slate-900/40'
                : 'border-slate-800 bg-slate-900'
            return (
              <div
                key={member.name}
                className={`border rounded-lg p-4 ${statusColor}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">{member.name}</p>
                  {member.status === 'overloaded' && (
                    <span className="text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded">
                      Overloaded
                    </span>
                  )}
                  {member.status === 'idle' && (
                    <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      Idle
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{member.openTickets} open</span>
                  {member.overdueTickets > 0 && (
                    <span className="text-red-400">{member.overdueTickets} overdue</span>
                  )}
                </div>
                {/* Load bar */}
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      member.openTickets >= 10 ? 'bg-red-500' :
                      member.openTickets >= 6 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (member.openTickets / 15) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Link
            href="/itsm/queue"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View support queue <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/execution"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Execution tracker <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </CommandPageShell>
  )
}
