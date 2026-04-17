import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { executionInitiatives, executiveDecisions, orgs } from '@nzila/db/schema'
import { and, asc, eq, lt, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function statusIsClosed(status: string | null): boolean {
  return ['done', 'completed', 'cancelled'].includes((status ?? '').toLowerCase())
}

async function getExecutiveOrgId(): Promise<string | null> {
  const rows = await platformDb
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.status, 'active'))
    .limit(1)
  return rows[0]?.id ?? null
}

export default async function AccountabilityPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const executiveOrgId = await getExecutiveOrgId()
  if (!executiveOrgId) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accountability</h1>
        <p className="text-sm text-gray-500 mt-2">No executive organization configured yet.</p>
      </div>
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const staleCutoff = new Date()
  staleCutoff.setDate(staleCutoff.getDate() - 7)
  const velocityCutoff = new Date()
  velocityCutoff.setDate(velocityCutoff.getDate() - 14)

  const [initiatives, decisions] = await Promise.all([
    platformDb
      .select({
        id: executionInitiatives.id,
        title: executionInitiatives.title,
        venture: executionInitiatives.venture,
        owner: executionInitiatives.owner,
        dueDate: executionInitiatives.dueDate,
        status: executionInitiatives.status,
        updatedAt: executionInitiatives.updatedAt,
      })
      .from(executionInitiatives)
      .where(eq(executionInitiatives.orgId, executiveOrgId))
      .orderBy(asc(executionInitiatives.dueDate)),
    platformDb
      .select({
        id: executiveDecisions.id,
        title: executiveDecisions.title,
        owner: executiveDecisions.owner,
        dueDate: executiveDecisions.dueDate,
        status: executiveDecisions.status,
        priority: executiveDecisions.priority,
      })
      .from(executiveDecisions)
      .where(eq(executiveDecisions.orgId, executiveOrgId))
      .orderBy(asc(executiveDecisions.dueDate)),
  ])

  const openInitiatives = initiatives.filter((initiative) => !statusIsClosed(initiative.status))
  const overdueInitiatives = openInitiatives.filter((initiative) => initiative.dueDate && initiative.dueDate < todayIso)
  const stalledInitiatives = openInitiatives.filter((initiative) => initiative.updatedAt && new Date(initiative.updatedAt) < staleCutoff)
  const noOwnerInitiatives = openInitiatives.filter((initiative) => !initiative.owner)

  const ownerLoad = new Map<string, number>()
  for (const initiative of openInitiatives) {
    const owner = initiative.owner || 'Unassigned'
    ownerLoad.set(owner, (ownerLoad.get(owner) ?? 0) + 1)
  }
  const ownerLoadRows = Array.from(ownerLoad.entries())
    .map(([owner, count]) => ({ owner, count }))
    .sort((left, right) => right.count - left.count)

  const completedRecently = initiatives.filter((initiative) => {
    if (!statusIsClosed(initiative.status)) return false
    if (!initiative.updatedAt) return false
    return new Date(initiative.updatedAt) >= velocityCutoff
  }).length
  const velocityPerWeek = completedRecently / 2

  const decisionOverdue = decisions.filter((decision) =>
    !statusIsClosed(decision.status) && Boolean(decision.dueDate) && String(decision.dueDate) < todayIso,
  )
  const criticalOpenDecisions = decisions.filter((decision) => !statusIsClosed(decision.status) && decision.priority === 'p0')

  const alertLevel = overdueInitiatives.length >= 3 || stalledInitiatives.length >= 3 || criticalOpenDecisions.length > 0
    ? 'critical'
    : overdueInitiatives.length > 0 || noOwnerInitiatives.length > 0
      ? 'warning'
      : 'healthy'

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accountability</h1>
        <p className="text-sm text-gray-500 mt-2">Execution debt and owner load from live initiatives and approved decisions.</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Open Initiatives</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{openInitiatives.length}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs uppercase text-red-600">Overdue</p>
          <p className="text-2xl font-bold text-red-700 mt-2">{overdueInitiatives.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase text-amber-700">Stalled 7d+</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stalledInitiatives.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">No Owner</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{noOwnerInitiatives.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Decision Overdue</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{decisionOverdue.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-500">Velocity / Week</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{velocityPerWeek.toFixed(1)}</p>
        </div>
      </div>

      <div className={`rounded-xl p-4 border ${alertLevel === 'critical' ? 'border-red-200 bg-red-50' : alertLevel === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <p className="text-sm font-semibold text-gray-900">
          {alertLevel === 'critical' ? 'Critical execution drag detected.' : alertLevel === 'warning' ? 'Warning: accountability drift detected.' : 'Execution cadence healthy.'}
        </p>
        <p className="text-sm text-gray-700 mt-1">
          Keep all P0 and overdue decisions linked to active initiatives. Every approved decision must show movement inside 7 days.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Overdue Or Stalled Initiatives</h2>
          <div className="space-y-3">
            {[...overdueInitiatives, ...stalledInitiatives].slice(0, 10).map((initiative) => (
              <div key={initiative.id} className="rounded-lg border border-gray-200 px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">{initiative.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {initiative.venture || 'unknown venture'} · owner {initiative.owner || 'unassigned'} · {initiative.status}
                </p>
              </div>
            ))}
            {overdueInitiatives.length + stalledInitiatives.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No overdue or stalled initiatives.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Owner Load</h2>
          <div className="space-y-3">
            {ownerLoadRows.map((owner) => (
              <div key={owner.owner} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-900">{owner.owner}</span>
                <span className="text-sm font-semibold text-gray-700">{owner.count}</span>
              </div>
            ))}
            {ownerLoadRows.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active initiatives to load-balance.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Open P0 Decisions</h2>
        <div className="space-y-3">
          {criticalOpenDecisions.map((decision) => (
            <div key={decision.id} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{decision.title}</p>
              <p className="text-xs text-gray-600 mt-1">Owner {decision.owner || 'unassigned'} · due {decision.dueDate || 'n/a'} · {decision.status}</p>
            </div>
          ))}
          {criticalOpenDecisions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No open P0 decisions.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
