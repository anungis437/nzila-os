/**
 * Nzila OS — Growth Cockpit
 *
 * Operator surface for the GrowthOS layer. Composes:
 *   - growth-os campaigns / lead scores / proof / founder topics (file-backed)
 *   - commerceQuotes pipeline (existing platform DB)
 *   - partner deals (existing platform DB)
 *
 * Hard rule: every section is hidden if it has no data. No empty widgets,
 * no fake KPIs. Every $ comes from a real database row or a real growth-os
 * record.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { commerceQuotes, deals } from '@nzila/db/schema'
import { desc, sql } from 'drizzle-orm'
import {
  campaigns as growthCampaigns,
  scoring,
  proof,
  founder,
  recommendBatch,
  GROWTH_OS_VERSION,
  type LeadScore,
  type GrowthScope,
  type Campaign,
  type ProofRequest,
  type FounderTopic,
} from '@nzila/platform-growth-os'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────

interface PipelineQuote {
  id: string
  ref: string | null
  status: string
  total: string | null
  currency: string | null
  createdAt: Date | null
}

interface PartnerDeal {
  id: string
  partnerId: string | null
  accountName: string | null
  stage: string | null
  estimatedArr: string | null
}

interface GrowthData {
  scope: GrowthScope
  campaigns: Campaign[]
  campaignsByStatus: Map<string, number>
  topScores: LeadScore[]
  recommendations: Array<{ score: LeadScore; action: ReturnType<typeof recommendBatch>[number] }>
  proofs: ProofRequest[]
  proofsByStatus: Map<string, number>
  topics: FounderTopic[]
  dueTopics: Array<FounderTopic & { overdueDays: number }>
  // External composition
  openQuotes: PipelineQuote[]
  openQuotesValueCad: number
  partnerDeals: PartnerDeal[]
  partnerPipelineCad: number
  // Availability flags
  quotesAvailable: boolean
  partnerDealsAvailable: boolean
}

// ── Loader ─────────────────────────────────────────────────────────────────

async function loadGrowthData(scope: GrowthScope): Promise<GrowthData> {
  const cmps = growthCampaigns.listCampaigns(scope)
  const allScores = scoring.listLeadScores(scope)
  const topScores = [...allScores].sort((a, b) => b.score - a.score).slice(0, 10)
  const recBatch = recommendBatch(topScores)
  const recById = new Map(recBatch.map((r) => [r.sourceScoreId, r]))
  const recommendations = topScores
    .map((s) => ({ score: s, action: recById.get(s.id)! }))
    .filter((r) => r.action)

  const proofs = proof.listProofRequests(scope)
  const topics = founder.listFounderTopics(scope)
  // Compute "due" inline because dueFounderTopics requires a specific ownerId
  // and the cockpit aggregates across owners.
  const nowMs = Date.now()
  const due = topics
    .filter((t) => t.status === 'active')
    .map((t) => {
      const ageDays = t.lastSurfacedAt
        ? (nowMs - Date.parse(t.lastSurfacedAt)) / 86_400_000
        : Number.POSITIVE_INFINITY
      const overdueDays = Number.isFinite(ageDays) ? ageDays - t.cadenceDays : t.cadenceDays
      return { ...t, overdueDays }
    })
    .filter((t) => t.overdueDays >= 0)
    .sort((a, b) => b.overdueDays - a.overdueDays)

  const campaignsByStatus = new Map<string, number>()
  for (const c of cmps) campaignsByStatus.set(c.status, (campaignsByStatus.get(c.status) ?? 0) + 1)

  const proofsByStatus = new Map<string, number>()
  for (const p of proofs) proofsByStatus.set(p.status, (proofsByStatus.get(p.status) ?? 0) + 1)

  // External composition.
  let openQuotes: PipelineQuote[] = []
  let quotesAvailable = false
  try {
    openQuotes = await platformDb
      .select({
        id: commerceQuotes.id,
        ref: commerceQuotes.ref,
        status: commerceQuotes.status,
        total: commerceQuotes.total,
        currency: commerceQuotes.currency,
        createdAt: commerceQuotes.createdAt,
      })
      .from(commerceQuotes)
      .where(sql`${commerceQuotes.status} IN ('draft', 'sent')`)
      .orderBy(desc(commerceQuotes.createdAt))
      .limit(20)
    quotesAvailable = true
  } catch {
    // commerce table not provisioned in this env — section will hide.
  }
  const openQuotesValueCad = openQuotes.reduce((s, q) => {
    if (q.currency && q.currency !== 'CAD') return s
    const n = Number(q.total ?? 0)
    return Number.isFinite(n) ? s + n : s
  }, 0)

  let partnerDeals: PartnerDeal[] = []
  let partnerDealsAvailable = false
  try {
    partnerDeals = await platformDb
      .select({
        id: deals.id,
        partnerId: deals.partnerId,
        accountName: deals.accountName,
        stage: deals.stage,
        estimatedArr: deals.estimatedArr,
      })
      .from(deals)
      .orderBy(desc(deals.createdAt))
      .limit(20)
    partnerDealsAvailable = true
  } catch {
    // deals table not provisioned in this env — section will hide.
  }
  const partnerPipelineCad = partnerDeals.reduce((s, d) => {
    const n = Number(d.estimatedArr ?? 0)
    return Number.isFinite(n) ? s + n : s
  }, 0)

  return {
    scope,
    campaigns: cmps,
    campaignsByStatus,
    topScores,
    recommendations,
    proofs,
    proofsByStatus,
    topics,
    dueTopics: due,
    openQuotes,
    openQuotesValueCad,
    partnerDeals,
    partnerPipelineCad,
    quotesAvailable,
    partnerDealsAvailable,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCad(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function GrowthCockpitPage() {
  const session = await auth()
  if (!session?.userId) redirect('/sign-in')

  // Tenant + org are derived from the session. orgId on the session resolves
  // to the AD security-group GUID via Entra; for growth-os scoping we use the
  // app-level org id when available. Falling back to entra org id is safe
  // because growth-os records are partitioned by `scopeKey`.
  const orgId = session.orgId ?? 'unknown-org'
  const tenantId = session.userId // tenantId proxy until platform tenant is wired
  const scope: GrowthScope = { tenantId, orgId }

  const data = await loadGrowthData(scope)

  const hasAnything =
    data.campaigns.length > 0 ||
    data.topScores.length > 0 ||
    data.proofs.length > 0 ||
    data.topics.length > 0 ||
    data.openQuotes.length > 0 ||
    data.partnerDeals.length > 0

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          Zone: Growth · GrowthOS v{GROWTH_OS_VERSION}
        </p>
        <h1 className="text-2xl font-semibold text-gray-900">Growth Cockpit</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          The internal-agency operating layer. Campaigns, lead scoring,
          attribution, proof capture, and founder narrative — composed with the
          existing pipeline and partner GTM systems. Every number on this page
          is read from a real record. No invented metrics.
        </p>
      </header>

      {!hasAnything && (
        <section className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-700">
          <p className="font-medium">No GrowthOS records yet.</p>
          <p className="mt-1 text-gray-600">
            Seed brand voices, audiences, and campaigns via{' '}
            <code className="rounded bg-white px-1">@nzila/platform-growth-os</code> APIs,
            or run <code className="rounded bg-white px-1">pnpm growthos:report</code> in the repo root.
          </p>
        </section>
      )}

      {data.campaigns.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Campaigns</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[...data.campaignsByStatus.entries()].map(([s, n]) => (
              <div key={s} className="rounded border border-gray-200 bg-white p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">{s}</div>
                <div className="text-xl font-semibold text-gray-900">{n}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data.openQuotes.length > 0 || data.partnerDeals.length > 0) && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.quotesAvailable && (
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Open commercial quotes</h3>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {fmtCad(data.openQuotesValueCad)}
              </p>
              <p className="text-xs text-gray-500">
                {data.openQuotes.length} quote{data.openQuotes.length === 1 ? '' : 's'} (draft/sent, CAD only)
              </p>
              <Link
                className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                href="/revenue"
              >
                Open revenue cockpit →
              </Link>
            </div>
          )}
          {data.partnerDealsAvailable && (
            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Partner pipeline</h3>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {fmtCad(data.partnerPipelineCad)}
              </p>
              <p className="text-xs text-gray-500">
                {data.partnerDeals.length} partner deal
                {data.partnerDeals.length === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </section>
      )}

      {data.topScores.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Top lead scores</h2>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">Conf.</th>
                  <th className="px-3 py-2 text-left">Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {data.recommendations.map(({ score, action }) => (
                  <tr key={score.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {score.subjectKind}:{score.subjectId}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{score.stage}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{pct(score.score)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{pct(score.confidence)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{action.action}</div>
                      <div className="text-xs text-gray-500">{action.rationale}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.proofs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Proof pipeline</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {[...data.proofsByStatus.entries()].map(([s, n]) => (
              <div key={s} className="rounded border border-gray-200 bg-white p-3">
                <div className="truncate text-xs uppercase tracking-wide text-gray-500">{s}</div>
                <div className="text-xl font-semibold text-gray-900">{n}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.dueTopics.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Founder topics due</h2>
          <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
            {data.dueTopics.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-gray-900">{t.theme}</div>
                  <div className="text-xs text-gray-500">
                    cadence {t.cadenceDays}d · audiences: {t.audiences.join(', ')}
                  </div>
                </div>
                <div className="text-sm font-semibold text-amber-600">
                  +{Math.round(t.overdueDays)}d overdue
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
