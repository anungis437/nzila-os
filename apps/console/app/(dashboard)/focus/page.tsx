import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { founderTimeLogs, weeklyFocusTargets } from '@nzila/db/schema'
import {
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BoltIcon,
  RectangleGroupIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { getFounderFocusData } from '@/lib/executive-intelligence'
import { CommandPageShell } from '@/components/command-page-shell'

export const dynamic = 'force-dynamic'

async function addFounderLog(formData: FormData) {
  'use server'

  const orgId = String(formData.get('orgId') ?? '')
  const ventureId = String(formData.get('ventureId') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const hours = Number(formData.get('hours') ?? 0)
  const date = String(formData.get('date') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  const impactScoreRaw = String(formData.get('impactScore') ?? '').trim()

  if (!orgId || !ventureId || !category || !date || !Number.isFinite(hours) || hours <= 0) {
    return
  }

  await platformDb.insert(founderTimeLogs).values({
    orgId,
    ventureId,
    category,
    hours,
    date: new Date(date),
    notes: notes || null,
    impactScore: impactScoreRaw ? Number(impactScoreRaw) : null,
  })

  revalidatePath('/focus')
  revalidatePath('/today')
  revalidatePath('/portfolio')
  revalidatePath('/briefing')
}

async function upsertWeeklyTarget(formData: FormData) {
  'use server'

  const orgId = String(formData.get('orgId') ?? '')
  const ventureId = String(formData.get('ventureId') ?? '').trim()
  const targetHours = Number(formData.get('targetHours') ?? 0)
  const rationale = String(formData.get('rationale') ?? '').trim()

  if (!orgId || !ventureId || !Number.isFinite(targetHours) || targetHours <= 0) {
    return
  }

  const weekStart = new Date()
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)

  await platformDb
    .insert(weeklyFocusTargets)
    .values({
      orgId,
      ventureId,
      weekStart,
      targetHours,
      rationale: rationale || null,
    })
    .onConflictDoUpdate({
      target: [weeklyFocusTargets.orgId, weeklyFocusTargets.ventureId, weeklyFocusTargets.weekStart],
      set: {
        targetHours,
        rationale: rationale || null,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/focus')
  revalidatePath('/today')
  revalidatePath('/briefing')
}

function formatHours(value: number): string {
  return `${value.toFixed(1)}h`
}

function pct(value: number): string {
  return `${value.toFixed(0)}%`
}

function alertStyle(level: 'critical' | 'warning' | 'info') {
  if (level === 'critical') return 'bg-red-50 border-red-200 text-red-800'
  if (level === 'warning') return 'bg-amber-50 border-amber-200 text-amber-800'
  return 'bg-blue-50 border-blue-200 text-blue-700'
}

export default async function FocusPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await getFounderFocusData()
  const totalTrackedCategoryHours = Object.values(data.hoursByCategory30).reduce((sum, value) => sum + value, 0)
  const maxCategoryHours = Math.max(...Object.values(data.hoursByCategory30), 0)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <CommandPageShell as="div" className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Founder Focus</h1>
          <p className="text-sm text-gray-400 mt-1">
            Time allocation, fragmentation, and weekly founder leverage.
          </p>
        </div>
        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
          Coverage {pct(data.coveragePct)} of a 40h week
        </span>
      </div>

      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert) => (
            <div key={alert.message} className={`rounded-xl border px-4 py-3 text-sm font-medium ${alertStyle(alert.level)}`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">7d Hours</p>
          <p className="text-2xl font-bold text-gray-900">{formatHours(data.totalHours7)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">30d Hours</p>
          <p className="text-2xl font-bold text-gray-900">{formatHours(data.totalHours30)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Admin Drag</p>
          <p className={`text-2xl font-bold ${data.adminDragPct > 25 ? 'text-amber-600' : 'text-gray-900'}`}>{pct(data.adminDragPct)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Context Tax</p>
          <p className={`text-2xl font-bold ${data.contextSwitchTaxPct > 15 ? 'text-red-600' : 'text-gray-900'}`}>{pct(data.contextSwitchTaxPct)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Revenue / Hour</p>
          <p className="text-2xl font-bold text-gray-900">${data.revenuePerHour.toFixed(0)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pipeline / Sales Hr</p>
          <p className="text-2xl font-bold text-gray-900">${data.pipelinePerHour.toFixed(0)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1.8fr] gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <RectangleGroupIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Hours by Category</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data.hoursByCategory30)
              .sort((left, right) => right[1] - left[1])
              .map(([category, hours]) => (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-gray-600 capitalize">{category}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${maxCategoryHours > 0 ? (hours / maxCategoryHours) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-medium text-gray-700">{formatHours(hours)}</span>
                </div>
              ))}
          </div>
          {totalTrackedCategoryHours === 0 && (
            <p className="text-sm text-gray-400 italic">No logged founder time yet.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Weekly Recommendations</h2>
          </div>
          <div className="space-y-3">
            {data.recommendations.map((recommendation) => (
              <div key={recommendation} className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
                {recommendation}
              </div>
            ))}
            {data.recommendations.length === 0 && (
              <p className="text-sm text-gray-400 italic">Add more founder logs to unlock recommendations.</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Deep Work</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{pct(data.deepWorkScore)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Ventures / 7d</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.focusedVentures7}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Targets</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.currentWeekTargets.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Venture Time Allocation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">Venture</th>
                <th className="px-4 py-3">7d</th>
                <th className="px-4 py-3">30d</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Gap</th>
                <th className="px-4 py-3">Pilots</th>
                <th className="px-4 py-3">Cost 30d</th>
                <th className="px-4 py-3">Revenue / Hr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.ventureRows.map((row) => (
                <tr key={row.ventureId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{row.ventureName.replace(/-/g, ' ')}</p>
                      <p className="text-xs text-gray-400">Priority #{row.priority}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatHours(row.hours7)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatHours(row.hours30)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.targetHours > 0 ? formatHours(row.targetHours) : '—'}</td>
                  <td className={`px-4 py-3 ${row.focusGapHours < 0 ? 'text-blue-600' : row.focusGapHours > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {row.targetHours > 0 ? formatHours(row.focusGapHours) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.activePilots} active / {row.prospectPilots} prospect</td>
                  <td className="px-4 py-3 text-gray-700">${row.cost30Usd.toFixed(0)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.revenuePerHour > 0 ? `$${row.revenuePerHour.toFixed(0)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.executiveOrgId && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BoltIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Log Founder Time</h2>
            </div>
            <form action={addFounderLog} className="space-y-4">
              <input type="hidden" name="orgId" value={data.executiveOrgId} />
              <div className="grid grid-cols-2 gap-3">
                <input name="date" type="date" defaultValue={today} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="ventureId" placeholder="venture id (e.g. flow)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <select name="category" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="sales">sales</option>
                  <option value="build">build</option>
                  <option value="admin">admin</option>
                  <option value="finance">finance</option>
                  <option value="strategy">strategy</option>
                  <option value="context-switch">context-switch</option>
                </select>
                <input name="hours" type="number" step="0.25" min="0.25" placeholder="hours" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <input name="notes" placeholder="what moved?" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="impactScore" type="number" min="1" max="10" placeholder="impact 1-10" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium">
                <ArrowPathIcon className="h-4 w-4" /> Save log
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Set Weekly Focus Target</h2>
            </div>
            <form action={upsertWeeklyTarget} className="space-y-4">
              <input type="hidden" name="orgId" value={data.executiveOrgId} />
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <input name="ventureId" placeholder="venture id" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="targetHours" type="number" min="1" step="1" placeholder="target hrs" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <input name="rationale" placeholder="why this deserves time this week" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Save target
              </button>
            </form>
          </div>
        </div>
      )}
    </CommandPageShell>
  )
}