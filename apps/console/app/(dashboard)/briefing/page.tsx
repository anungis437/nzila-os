import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { executiveDecisions, executionInitiatives } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { getWeeklyBriefingData } from '@/lib/executive-intelligence'
import { loadIntelligenceDigest } from '@/lib/executive-intelligence-digest'
import { CommandPageShell } from '@/components/command-page-shell'

export const dynamic = 'force-dynamic'

async function approveDecisionAction(formData: FormData) {
  'use server'

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = String(formData.get('orgId') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!orgId || !title) return

  const rationale = String(formData.get('rationale') ?? '').trim() || null
  const ventureId = String(formData.get('ventureId') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'product').trim()
  const priority = String(formData.get('priority') ?? 'p2').trim()
  const owner = String(formData.get('owner') ?? 'Founder').trim() || 'Founder'
  const dueDays = Number(formData.get('dueDays') ?? 7)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (Number.isFinite(dueDays) ? dueDays : 7))
  const dueDateIso = dueDate.toISOString().slice(0, 10)

  const initiative = await platformDb
    .insert(executionInitiatives)
    .values({
      orgId,
      title: `[Decision] ${title}`,
      venture: ventureId,
      zone: category,
      owner,
      dueDate: dueDateIso,
      status: 'not-started',
      urgent: priority === 'p0',
    })
    .returning({ id: executionInitiatives.id })

  await platformDb.insert(executiveDecisions).values({
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

  revalidatePath('/briefing')
  revalidatePath('/execution')
  revalidatePath('/today')
  revalidatePath('/accountability')
}

export default async function BriefingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await getWeeklyBriefingData()
  const digest = data.executiveOrgId
    ? await loadIntelligenceDigest(data.executiveOrgId, { topN: 5 })
    : null
  const recentDecisions = data.executiveOrgId
    ? await platformDb
      .select({
        id: executiveDecisions.id,
        title: executiveDecisions.title,
        status: executiveDecisions.status,
        priority: executiveDecisions.priority,
      })
      .from(executiveDecisions)
      .where(eq(executiveDecisions.orgId, data.executiveOrgId))
      .limit(8)
    : []

  return (
    <CommandPageShell as="div" className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Weekly CEO Briefing</h1>
        <p className="text-sm text-gray-400 mt-1">Blunt, concise, and decision-oriented. Read in under 5 minutes.</p>
      </div>

      <div className="rounded-2xl bg-gray-900 text-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">Executive Summary</p>
        <p className="text-2xl font-semibold mt-3 leading-tight">{data.summarySentence}</p>
      </div>

      {digest && (digest.topPriorities.length > 0 || digest.diff.droppedFromTop.length > 0) && (
        <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">Intelligence Radar — Top 5 Priorities</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                <span className="font-semibold text-red-700">{digest.activeRiskCount}</span> active risks
              </span>
              <span>·</span>
              <span>
                <span className="font-semibold text-emerald-700">{digest.activeOpportunityCount}</span> opportunities
              </span>
              {digest.lastSnapshotAt && (
                <>
                  <span>·</span>
                  <span>last snapshot {new Date(digest.lastSnapshotAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          {digest.topPriorities.length > 0 ? (
            <ol className="space-y-2">
              {digest.topPriorities.map((p, i) => {
                const isNew = digest.diff.newTop.some((n) => n.id === p.id)
                return (
                  <li
                    key={p.id}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">0{i + 1}</span>
                        <span className="text-sm font-medium text-gray-900">{p.title}</span>
                        {isNew && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                            new
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.narrative}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{p.rankScore.toFixed(0)}</p>
                      <p className="text-[10px] uppercase text-gray-400">{p.rankBucket.replace('_', ' ')}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No open recommendations yet.{' '}
              <Link href="/intelligence/risks" className="underline">
                Run synthesis
              </Link>{' '}
              to populate.
            </p>
          )}
          {digest.diff.droppedFromTop.length > 0 && (
            <div className="text-xs text-gray-500">
              <span className="font-semibold uppercase tracking-wide text-gray-400">Dropped from top</span>{' '}
              {digest.diff.droppedFromTop
                .slice(0, 3)
                .map((d) => d.title)
                .join(' · ')}
            </div>
          )}
          {digest.diff.oneToIgnore && (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <span className="font-semibold text-gray-700">One thing to ignore this week:</span>{' '}
              {digest.diff.oneToIgnore.title}{' '}
              <span className="text-xs text-gray-400">
                (score {digest.diff.oneToIgnore.rankScore.toFixed(0)}, {digest.diff.oneToIgnore.rankBucket.replace('_', ' ')})
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs">
            <Link href="/intelligence/risks" className="text-indigo-600 underline hover:text-indigo-800">
              View risks →
            </Link>
            <Link href="/intelligence/opportunities" className="text-indigo-600 underline hover:text-indigo-800">
              View opportunities →
            </Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold text-gray-900">What Improved</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {data.improved.length > 0 ? data.improved.map((item) => (
              <div key={item} className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">{item}</div>
            )) : <p className="text-gray-400 italic">No material improvement captured this week.</p>}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-gray-900">What Worsened</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {data.worsened.length > 0 ? data.worsened.map((item) => (
              <div key={item} className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">{item}</div>
            )) : <p className="text-gray-400 italic">No worsening trend captured this week.</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <BanknotesIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Cash Position</h2>
          </div>
          <p className="text-sm text-gray-700">{data.cashPositionChange}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Top Venture</h2>
          {data.topVenture ? (
            <>
              <p className="text-lg font-bold text-gray-900 capitalize">{data.topVenture.ventureName.replace(/-/g, ' ')}</p>
              <p className="text-sm text-gray-500 mt-1">Score {data.topVenture.score} · {data.topVenture.action}</p>
              <p className="text-sm text-gray-700 mt-3">{data.topVenture.rationale}</p>
            </>
          ) : <p className="text-sm text-gray-400 italic">No ranking available.</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Lowest Venture ROI</h2>
          {data.lowestVenture ? (
            <>
              <p className="text-lg font-bold text-gray-900 capitalize">{data.lowestVenture.ventureName.replace(/-/g, ' ')}</p>
              <p className="text-sm text-gray-500 mt-1">Score {data.lowestVenture.score} · {data.lowestVenture.action}</p>
              <p className="text-sm text-gray-700 mt-3">{data.lowestVenture.rationale}</p>
            </>
          ) : <p className="text-sm text-gray-400 italic">No ranking available.</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Top 5 Decisions Needed Now</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {data.decisionCandidates.map((item, index) => (
              <form key={`${item.title}-${index}`} action={approveDecisionAction} className="rounded-lg border border-gray-200 px-4 py-3 space-y-2">
                <input type="hidden" name="orgId" value={data.executiveOrgId ?? ''} />
                <input type="hidden" name="title" value={item.title} />
                <input type="hidden" name="rationale" value={item.rationale} />
                <input type="hidden" name="ventureId" value={item.ventureId ?? ''} />
                <input type="hidden" name="category" value={item.category} />
                <input type="hidden" name="priority" value={item.priority} />
                <input type="hidden" name="owner" value={item.owner} />
                <input type="hidden" name="dueDays" value={String(item.dueDays)} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">0{index + 1}</span>
                    {item.title}
                  </div>
                  <span className="text-[11px] uppercase font-semibold text-gray-500">{item.priority}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>{item.category} · owner {item.owner}</span>
                  <button
                    type="submit"
                    disabled={!data.executiveOrgId}
                    className="inline-flex items-center rounded-md bg-gray-900 px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
                  >
                    Approve Decision
                  </button>
                </div>
              </form>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Deals Needing Founder Action</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {data.dealsNeedingFounderAction.length > 0 ? data.dealsNeedingFounderAction.map((deal) => (
              <div key={deal.ref} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{deal.ref}</p>
                  <p className="text-xs text-gray-400">{deal.status} · {deal.ageDays}d old</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">${deal.valueUsd.toFixed(0)}</span>
              </div>
            )) : <p className="text-gray-400 italic">No deal has crossed the founder-attention threshold.</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Suggested Time Allocation Next Week</h2>
          <div className="space-y-3">
            {data.suggestedTimeAllocation.map((row) => (
              <div key={row.ventureId} className="rounded-lg bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 capitalize">{row.ventureName.replace(/-/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{row.note}</p>
                </div>
                <span className="text-lg font-bold text-gray-900">{row.hours}h</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Suggested Spend Allocation Next Month</h2>
          <div className="space-y-3">
            {data.suggestedSpendAllocation.map((row) => (
              <div key={row.ventureId} className="rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900 capitalize">{row.ventureName.replace(/-/g, ' ')}</p>
                  <span className="text-sm font-semibold text-gray-700">{row.action}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Risks Rising</h2>
        <div className="space-y-3 text-sm text-gray-700">
          {data.risksRising.length > 0 ? data.risksRising.map((risk) => (
            <div key={risk} className="rounded-lg border border-gray-200 px-4 py-3">{risk}</div>
          )) : <p className="text-gray-400 italic">No elevated risk flagged this week.</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Decisions</h2>
        <div className="space-y-3 text-sm text-gray-700">
          {recentDecisions.length > 0 ? recentDecisions.map((decision) => (
            <div key={decision.id} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-gray-900">{decision.title}</span>
              <span className="text-xs uppercase font-semibold text-gray-500">{decision.priority} · {decision.status}</span>
            </div>
          )) : <p className="text-gray-400 italic">No approved decisions captured yet.</p>}
        </div>
      </div>
    </CommandPageShell>
  )
}