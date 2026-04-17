import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { decisionScorebacks, executiveDecisions } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'
import { ChartBarSquareIcon } from '@heroicons/react/24/outline'
import { getWeeklyBriefingData } from '@/lib/executive-intelligence'

export const dynamic = 'force-dynamic'

function computeAccuracyScore(expectedRoiPct: number | null, actualRoiPct: number | null): number | null {
  if (expectedRoiPct == null || actualRoiPct == null) return null
  const delta = Math.abs(expectedRoiPct - actualRoiPct)
  return Math.max(0, Math.min(100, 100 - delta))
}

const ALLOWED_OUTCOME_STATUSES = new Set(['pending', 'on-track', 'exceeded', 'missed', 'cancelled'])

function toFiniteNumberOrNull(value: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

async function scorebackAction(formData: FormData) {
  'use server'

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = String(formData.get('orgId') ?? '').trim()
  const decisionId = String(formData.get('decisionId') ?? '').trim()
  if (!orgId || !decisionId) return

  const expectedResult = String(formData.get('expectedResult') ?? '').trim() || 'Expected execution upside'
  const actualResult = String(formData.get('actualResult') ?? '').trim() || null
  const rawOutcomeStatus = String(formData.get('outcomeStatus') ?? 'pending').trim()
  const outcomeStatus = ALLOWED_OUTCOME_STATUSES.has(rawOutcomeStatus) ? rawOutcomeStatus : 'pending'

  const expectedRoiRaw = String(formData.get('expectedRoiPct') ?? '').trim()
  const actualRoiRaw = String(formData.get('actualRoiPct') ?? '').trim()
  const confidenceRaw = String(formData.get('confidenceAtDecision') ?? '').trim()

  const expectedRoiPctRaw = toFiniteNumberOrNull(expectedRoiRaw)
  const actualRoiPctRaw = toFiniteNumberOrNull(actualRoiRaw)
  const confidenceAtDecisionRaw = toFiniteNumberOrNull(confidenceRaw)
  const expectedRoiPct = expectedRoiPctRaw == null ? null : clamp(expectedRoiPctRaw, -1000, 1000)
  const actualRoiPct = actualRoiPctRaw == null ? null : clamp(actualRoiPctRaw, -1000, 1000)
  const confidenceAtDecision = confidenceAtDecisionRaw == null ? null : clamp(confidenceAtDecisionRaw, 0, 1)

  const accuracyScore = computeAccuracyScore(expectedRoiPct, actualRoiPct)

  await platformDb
    .insert(decisionScorebacks)
    .values({
      orgId,
      decisionId,
      expectedResult,
      actualResult,
      expectedRoiPct,
      actualRoiPct,
      confidenceAtDecision,
      outcomeStatus,
      accuracyScore,
      evaluatedAt: outcomeStatus === 'pending' ? null : new Date(),
    })
    .onConflictDoUpdate({
      target: [decisionScorebacks.orgId, decisionScorebacks.decisionId],
      set: {
        expectedResult,
        actualResult,
        expectedRoiPct,
        actualRoiPct,
        confidenceAtDecision,
        outcomeStatus,
        accuracyScore,
        evaluatedAt: outcomeStatus === 'pending' ? null : new Date(),
        updatedAt: new Date(),
      },
    })

  revalidatePath('/decision-scoreback')
  revalidatePath('/ceo')
}

export default async function DecisionScorebackPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const briefing = await getWeeklyBriefingData()
  const orgId = briefing.executiveOrgId

  const decisions = orgId
    ? await platformDb
      .select({
        id: executiveDecisions.id,
        title: executiveDecisions.title,
        status: executiveDecisions.status,
        priority: executiveDecisions.priority,
        createdAt: executiveDecisions.createdAt,
      })
      .from(executiveDecisions)
      .where(eq(executiveDecisions.orgId, orgId))
      .orderBy(desc(executiveDecisions.createdAt))
      .limit(24)
    : []

  const scorebacks = orgId
    ? await platformDb
      .select({
        decisionId: decisionScorebacks.decisionId,
        expectedResult: decisionScorebacks.expectedResult,
        actualResult: decisionScorebacks.actualResult,
        expectedRoiPct: decisionScorebacks.expectedRoiPct,
        actualRoiPct: decisionScorebacks.actualRoiPct,
        confidenceAtDecision: decisionScorebacks.confidenceAtDecision,
        outcomeStatus: decisionScorebacks.outcomeStatus,
        accuracyScore: decisionScorebacks.accuracyScore,
      })
      .from(decisionScorebacks)
      .where(eq(decisionScorebacks.orgId, orgId))
    : []

  const byDecision = new Map(scorebacks.map((row) => [row.decisionId, row]))
  const accuracyRows = scorebacks.filter((row) => row.accuracyScore != null)
  const averageAccuracy = accuracyRows.length > 0
    ? accuracyRows.reduce((sum, row) => sum + Number(row.accuracyScore ?? 0), 0) / accuracyRows.length
    : null

  const confidenceGapRows = scorebacks
    .filter((row) => row.confidenceAtDecision != null && row.accuracyScore != null)
    .map((row) => Math.abs(Number(row.confidenceAtDecision) * 100 - Number(row.accuracyScore)))
  const confidenceGap = confidenceGapRows.length > 0
    ? confidenceGapRows.reduce((sum, value) => sum + value, 0) / confidenceGapRows.length
    : null

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Decision Scoreback</h1>
          <p className="text-sm text-gray-500 mt-1">Expected vs actual outcomes for decision quality learning.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wider text-gray-400">Accuracy Trend</p>
          <p className="text-2xl font-bold text-gray-900">{averageAccuracy == null ? 'N/A' : `${averageAccuracy.toFixed(0)}%`}</p>
          <p className="text-xs text-gray-500 mt-1">Confidence gap: {confidenceGap == null ? 'N/A' : `${confidenceGap.toFixed(1)} pts`}</p>
        </div>
      </div>

      <div className="space-y-4">
        {decisions.map((decision) => {
          const scoreback = byDecision.get(decision.id)
          return (
            <form key={decision.id} action={scorebackAction} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <input type="hidden" name="orgId" value={orgId ?? ''} />
              <input type="hidden" name="decisionId" value={decision.id} />

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">{decision.priority.toUpperCase()} · {decision.status}</p>
                  <p className="text-lg font-semibold text-gray-900">{decision.title}</p>
                </div>
                <ChartBarSquareIcon className="h-5 w-5 text-gray-400" />
              </div>

              <div className="grid lg:grid-cols-2 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-gray-600">Expected result</span>
                  <textarea name="expectedResult" defaultValue={scoreback?.expectedResult ?? ''} className="w-full rounded-md border border-gray-300 px-3 py-2" rows={2} />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-600">Actual result</span>
                  <textarea name="actualResult" defaultValue={scoreback?.actualResult ?? ''} className="w-full rounded-md border border-gray-300 px-3 py-2" rows={2} />
                </label>
              </div>

              <div className="grid md:grid-cols-4 gap-3 text-sm">
                <label className="space-y-1">
                  <span className="text-gray-600">Expected ROI %</span>
                  <input type="number" step="0.1" name="expectedRoiPct" defaultValue={scoreback?.expectedRoiPct ?? ''} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-600">Actual ROI %</span>
                  <input type="number" step="0.1" name="actualRoiPct" defaultValue={scoreback?.actualRoiPct ?? ''} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-600">Confidence at decision (0-1)</span>
                  <input type="number" step="0.01" min="0" max="1" name="confidenceAtDecision" defaultValue={scoreback?.confidenceAtDecision ?? ''} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                </label>
                <label className="space-y-1">
                  <span className="text-gray-600">Outcome status</span>
                  <select name="outcomeStatus" defaultValue={scoreback?.outcomeStatus ?? 'pending'} className="w-full rounded-md border border-gray-300 px-3 py-2">
                    <option value="pending">pending</option>
                    <option value="on-track">on-track</option>
                    <option value="exceeded">exceeded</option>
                    <option value="missed">missed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={!orgId}
                className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save Scoreback
              </button>
            </form>
          )
        })}
      </div>
    </div>
  )
}
