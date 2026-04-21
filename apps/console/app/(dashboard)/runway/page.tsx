import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { runwayAssumptions, treasurySnapshots } from '@nzila/db/schema'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import { getRunwayData } from '@/lib/executive-intelligence'

export const dynamic = 'force-dynamic'

async function addTreasurySnapshot(formData: FormData) {
  'use server'

  const orgId = String(formData.get('orgId') ?? '')
  const date = String(formData.get('date') ?? '')
  if (!orgId || !date) return

  await platformDb.insert(treasurySnapshots).values({
    orgId,
    date: new Date(date),
    cashOnHand: String(Number(formData.get('cashOnHand') ?? 0) || 0),
    restrictedCash: String(Number(formData.get('restrictedCash') ?? 0) || 0),
    receivables: String(Number(formData.get('receivables') ?? 0) || 0),
    liabilitiesDue30d: String(Number(formData.get('liabilitiesDue30d') ?? 0) || 0),
    notes: String(formData.get('notes') ?? '').trim() || null,
  })

  revalidatePath('/runway')
  revalidatePath('/today')
  revalidatePath('/briefing')
}

async function upsertRunwayAssumption(formData: FormData) {
  'use server'

  const orgId = String(formData.get('orgId') ?? '')
  const mode = String(formData.get('mode') ?? '')
  if (!orgId || !mode) return

  const expectedMonthlyRevenue = Number(formData.get('expectedMonthlyRevenue') ?? 0) || 0
  const plannedHires = Number(formData.get('plannedHires') ?? 0) || 0
  const discretionarySpend = Number(formData.get('discretionarySpend') ?? 0) || 0

  await platformDb
    .insert(runwayAssumptions)
    .values({
      orgId,
      mode,
      expectedMonthlyRevenue: String(expectedMonthlyRevenue),
      plannedHires,
      discretionarySpend: String(discretionarySpend),
    })
    .onConflictDoUpdate({
      target: [runwayAssumptions.orgId, runwayAssumptions.mode],
      set: {
        expectedMonthlyRevenue: String(expectedMonthlyRevenue),
        plannedHires,
        discretionarySpend: String(discretionarySpend),
        updatedAt: new Date(),
      },
    })

  revalidatePath('/runway')
  revalidatePath('/today')
  revalidatePath('/briefing')
}

function formatMoney(value: number): string {
  return `$${value.toFixed(0)}`
}

function scenarioTone(months: number): string {
  if (months < 3) return 'text-red-600'
  if (months < 6) return 'text-amber-600'
  return 'text-emerald-600'
}

function decisionTone(level: 'critical' | 'warning' | 'info') {
  if (level === 'critical') return 'bg-red-50 border-red-200 text-red-800'
  if (level === 'warning') return 'bg-amber-50 border-amber-200 text-amber-800'
  return 'bg-blue-50 border-blue-200 text-blue-700'
}

export default async function RunwayPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await getRunwayData()
  const today = new Date().toISOString().slice(0, 10)
  const baseScenario = data.scenarioRows.find((row) => row.mode === 'base') ?? data.scenarioRows[0]

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BanknotesIcon className="h-8 w-8 text-gray-300" />
            True Runway
          </h1>
          <p className="text-sm text-gray-400 mt-1">Cash, working capital, receivables pressure, and hiring affordability.</p>
        </div>
        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
          {data.dataQuality}
        </span>
      </div>

      {data.decisions.length > 0 && (
        <div className="space-y-2">
          {data.decisions.map((decision) => (
            <div key={decision.message} className={`rounded-xl border px-4 py-3 text-sm font-medium ${decisionTone(decision.level)}`}>
              {decision.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cash Now</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(data.cashNowUsd)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Net Working Capital</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(data.netWorkingCapitalUsd)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Monthly Burn</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(data.monthlyBurnUsd)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Base Runway</p>
          <p className={`text-2xl font-bold ${scenarioTone(baseScenario?.runwayMonths ?? 0)}`}>{(baseScenario?.runwayMonths ?? 0).toFixed(1)} mo</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Safe Spend Threshold</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(data.safeSpendThresholdUsd)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Runway Scenarios</h2>
          </div>
          <div className="space-y-3">
            {data.scenarioRows.map((row) => (
              <div key={row.mode} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 capitalize">{row.mode}</p>
                  <p className="text-xs text-gray-400">Net burn {formatMoney(row.netBurnUsd)} / month</p>
                </div>
                <p className={`text-xl font-bold ${scenarioTone(row.runwayMonths)}`}>{row.runwayMonths.toFixed(1)} mo</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Hiring Affordability</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.hiringAffordability}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Upcoming Obligations</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatMoney(data.upcomingObligationsUsd)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldExclamationIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Receivables Aging</h2>
          </div>
          <div className="space-y-3">
            {data.receivablesAging.map((bucket) => (
              <div key={bucket.bucket} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <span className="text-sm text-gray-600">{bucket.bucket}</span>
                <span className="text-sm font-semibold text-gray-900">{formatMoney(bucket.amountUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.executiveOrgId && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Add Treasury Snapshot</h2>
            <form action={addTreasurySnapshot} className="space-y-4">
              <input type="hidden" name="orgId" value={data.executiveOrgId} />
              <div className="grid grid-cols-2 gap-3">
                <input name="date" type="date" defaultValue={today} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="cashOnHand" type="number" min="0" step="0.01" placeholder="cash on hand" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="restrictedCash" type="number" min="0" step="0.01" placeholder="restricted cash" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="receivables" type="number" min="0" step="0.01" placeholder="receivables" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="liabilitiesDue30d" type="number" min="0" step="0.01" placeholder="liabilities due 30d" className="rounded-lg border border-gray-300 px-3 py-2 text-sm col-span-2" />
              </div>
              <input name="notes" placeholder="notes" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium">
                <ArrowPathIcon className="h-4 w-4" /> Save snapshot
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Update Runway Assumption</h2>
            <form action={upsertRunwayAssumption} className="space-y-4">
              <input type="hidden" name="orgId" value={data.executiveOrgId} />
              <div className="grid grid-cols-2 gap-3">
                <select name="mode" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="base">base</option>
                  <option value="growth">growth</option>
                  <option value="cut">cut</option>
                </select>
                <input name="plannedHires" type="number" min="0" step="1" placeholder="planned hires" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="expectedMonthlyRevenue" type="number" min="0" step="0.01" placeholder="expected monthly revenue" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input name="discretionarySpend" type="number" min="0" step="0.01" placeholder="discretionary spend" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Save assumption
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}