import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { decisionScorebacks, executiveDecisions, executionInitiatives } from '@nzila/db/schema'
import {
  BoltIcon,
  SparklesIcon,
  ShieldExclamationIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { generateAutopilotRecommendations } from '@/lib/autopilot-engine'
import { getWeeklyBriefingData } from '@/lib/executive-intelligence'
import { getDataFreshnessSummary } from '@/lib/data-freshness'
import { CommandPageShell } from '@/components/command-page-shell'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.autopilot')

const ALLOWED_CATEGORIES = new Set(['sales', 'capital', 'hiring', 'product', 'risk'])
const ALLOWED_URGENCIES = new Set(['critical', 'high', 'medium'])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

async function approveAutopilotAction(formData: FormData) {
  'use server'

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = String(formData.get('orgId') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!orgId || !title) return

  const rationale = String(formData.get('rationale') ?? '').trim() || null
  const ventureId = String(formData.get('ventureId') ?? '').trim() || null
  const rawCategory = String(formData.get('category') ?? 'product').trim()
  const rawUrgency = String(formData.get('urgency') ?? 'medium').trim()
  const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : 'product'
  const urgency = ALLOWED_URGENCIES.has(rawUrgency) ? rawUrgency : 'medium'
  const owner = String(formData.get('owner') ?? 'Founder').trim() || 'Founder'
  const dueDaysRaw = Number(formData.get('dueDays') ?? 7)
  const dueDays = Number.isFinite(dueDaysRaw) ? clamp(dueDaysRaw, 1, 30) : 7
  const expectedUpside = String(formData.get('expectedUpside') ?? '').trim() || 'Execution improvement'
  const confidenceRaw = Number(formData.get('confidence') ?? 0.7)
  const confidence = Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : 0.7

  const priority = urgency === 'critical' ? 'p0' : urgency === 'high' ? 'p1' : 'p2'
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + dueDays)
  const dueDateIso = dueDate.toISOString().slice(0, 10)

  try {
    const initiative = await platformDb
      .insert(executionInitiatives)
      .values({
        orgId,
        title: `[Autopilot] ${title}`,
        venture: ventureId,
        zone: category,
        owner,
        dueDate: dueDateIso,
        status: 'not-started',
        urgent: priority === 'p0',
      })
      .returning({ id: executionInitiatives.id })

    const decision = await platformDb
      .insert(executiveDecisions)
      .values({
        orgId,
        title,
        rationale,
        ventureId,
        category,
        priority,
        owner,
        dueDate: dueDateIso,
        status: 'approved',
        linkedInitiativeId: initiative[0]?.id,
      })
      .returning({ id: executiveDecisions.id })

    if (decision[0]?.id) {
      await platformDb.insert(decisionScorebacks).values({
        orgId,
        decisionId: decision[0].id,
        expectedResult: expectedUpside,
        confidenceAtDecision: Number.isFinite(confidence) ? confidence : 0.7,
        expectedByDate: dueDateIso,
        outcomeStatus: 'pending',
      })
    }
  } catch (error) {
    logger.warn('approve autopilot action failed; skipping write', {
      orgId,
      title,
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }

  revalidatePath('/autopilot')
  revalidatePath('/briefing')
  revalidatePath('/execution')
  revalidatePath('/decision-scoreback')
  revalidatePath('/ceo')
}

export default async function AutopilotPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [recommendations, briefing, freshness] = await Promise.all([
    generateAutopilotRecommendations(),
    getWeeklyBriefingData(),
    getDataFreshnessSummary(),
  ])

  return (
    <CommandPageShell as="div" className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Autopilot</h1>
          <p className="text-sm text-gray-500 mt-1">High-confidence recommendations you can approve in one click.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wider text-gray-400">Data Freshness</p>
          <p className="text-2xl font-bold text-gray-900">{freshness.overallScore}%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {recommendations.map((recommendation, index) => (
          <form key={`${recommendation.action}-${index}`} action={approveAutopilotAction} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <input type="hidden" name="orgId" value={briefing.executiveOrgId ?? ''} />
            <input type="hidden" name="title" value={recommendation.action} />
            <input type="hidden" name="rationale" value={recommendation.rationale} />
            <input type="hidden" name="ventureId" value={recommendation.ventureId ?? ''} />
            <input type="hidden" name="category" value={recommendation.category} />
            <input type="hidden" name="urgency" value={recommendation.urgency} />
            <input type="hidden" name="owner" value={recommendation.owner} />
            <input type="hidden" name="dueDays" value={String(recommendation.dueDays)} />
            <input type="hidden" name="expectedUpside" value={recommendation.expectedUpside} />
            <input type="hidden" name="confidence" value={String(recommendation.confidence)} />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">#{index + 1} Recommendation</p>
              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                recommendation.urgency === 'critical'
                  ? 'bg-red-100 text-red-700'
                  : recommendation.urgency === 'high'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-sky-100 text-sky-700'
              }`}>
                {recommendation.urgency}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-base font-semibold text-gray-900">{recommendation.action}</p>
              <p className="text-sm text-gray-600">{recommendation.rationale}</p>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <p><span className="font-semibold">Upside:</span> {recommendation.expectedUpside}</p>
              <p><span className="font-semibold">Owner:</span> {recommendation.owner}</p>
              <p><span className="font-semibold">Confidence:</span> {(recommendation.confidence * 100).toFixed(0)}%</p>
            </div>

            <button
              type="submit"
              disabled={!briefing.executiveOrgId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <SparklesIcon className="h-4 w-4" />
              Approve and Track
            </button>
          </form>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Module Freshness</h2>
          </div>
          <div className="space-y-2 text-sm">
            {freshness.modules.map((module) => (
              <div key={module.module} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-gray-700">{module.module}</span>
                <span className="text-gray-500">{module.lagHours == null ? 'unknown' : `${module.lagHours}h lag`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Autopilot Notes</h2>
          </div>
          <p className="text-sm text-gray-600">Autopilot recommendations are generated from runway pressure, venture ranking, receivables risk, founder attention tax, stale execution, and active decision backlog.</p>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
            <ShieldExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
            Approval writes a decision, links an initiative, and opens a scoreback record for learning quality.
          </div>
        </div>
      </div>
    </CommandPageShell>
  )
}
