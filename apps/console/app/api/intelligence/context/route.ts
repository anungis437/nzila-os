/**
 * GET /api/intelligence/context
 *
 * Compact JSON payload consumed by the AI Copilot layer.
 * Returns actionable executive context: open grants, top deals,
 * priority risks, product rankings, and tasks due this week.
 *
 * Auth-gated — returns 401 for unauthenticated requests.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { NextResponse } from 'next/server'
import {
  getOpenOpportunities,
  getUpcomingDeadlines,
  getDealPipeline,
  getStaleDeals,
  detectRisks,
  scoreProducts,
} from '@nzila/platform-intelligence-home'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Fetch all data in parallel
  const [openOpps, deadlines, allDeals, staleDeals, risks, scored] = await Promise.all([
    getOpenOpportunities(now),
    getUpcomingDeadlines(14, now),
    getDealPipeline(),
    getStaleDeals(14),
    detectRisks(now),
    scoreProducts(),
  ])

  // Top 5 apply-status grants sorted by confidence
  const activeGrants = openOpps
    .filter((o) => o.status === 'apply')
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      name: o.name,
      agency: o.agency,
      confidenceScore: o.confidenceScore,
      daysUntilDeadline: o.daysUntilDeadline,
      maxValueCad: o.typicalMaxCad ?? null,
    }))

  // Top 5 deals by weighted value (probability × estimatedValue)
  const topDeals = [...allDeals]
    .sort((a, b) => (b.probability * b.estimatedValueCad) - (a.probability * a.estimatedValueCad))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      org: d.org,
      product: d.product,
      stage: d.stage,
      probability: d.probability,
      estimatedValueCad: d.estimatedValueCad,
      weightedValueCad: Math.round((d.probability / 100) * d.estimatedValueCad),
      daysSinceActivity: d.daysSinceActivity,
    }))

  // Critical + high risks only
  const priorityRisks = risks
    .filter((r) => r.severity === 'critical' || r.severity === 'high')
    .map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      category: r.category,
      recommendedAction: r.recommendedAction,
    }))

  // Product rankings (top 8)
  const productRankings = scored.map((p) => ({
    rank: p.rank,
    productId: p.productId,
    totalScore: Math.round(p.totalScore),
    recommendedFocusHours: p.recommendedFocusHours,
    topStrength: p.strengths[0] ?? null,
    topGap: p.gaps[0] ?? null,
  }))

  // Tasks due: upcoming grant deadlines + stale deals needing follow-up
  const tasksDue = [
    ...deadlines.slice(0, 3).map((o) => ({
      type: 'grant_deadline' as const,
      label: `${o.name} deadline in ${o.daysUntilDeadline}d`,
      urgency: (o.daysUntilDeadline ?? 999) <= 7 ? 'urgent' : 'high',
      refId: o.id,
    })),
    ...staleDeals.slice(0, 3).map((d) => ({
      type: 'stale_deal' as const,
      label: `Follow up ${d.org} (${d.product}) — ${d.daysSinceActivity}d idle`,
      urgency: d.daysSinceActivity > 30 ? 'urgent' : 'high',
      refId: d.id,
    })),
  ]

  const payload = {
    generatedAt: now.toISOString(),
    activeGrants,
    topDeals,
    priorityRisks,
    productRankings,
    tasksDue,
  }

  return Response.json(payload, { headers: { 'x-request-id': requestId } })
}
