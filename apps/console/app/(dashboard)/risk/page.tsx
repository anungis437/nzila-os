/**
 * Nzila OS — Risk Center
 *
 * Zone 6: RISK — Platform risk, venture risk, financial risk, governance risk.
 * Answers: What is most likely to damage us this quarter?
 *          What are the top 5 risks right now?
 *
 * Data sources:
 *   - computeOpsScore()          → platform operational risk
 *   - product-catalog.json       → venture evidence/code gaps
 *   - platformCostBudgetBreaches → financial risk
 *   - approvals (pending count)  → governance bottleneck risk
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { approvals, platformCostBudgetBreaches, auditEvents } from '@nzila/db/schema'
import { count, eq, desc } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import {
  computeOpsScore,
  computeOpsScoreDelta,
} from '@nzila/platform-ops'
import {
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  FireIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskSeverity = 'critical' | 'high' | 'medium' | 'low'

interface RiskItem {
  id: string
  category: 'platform' | 'venture' | 'financial' | 'governance'
  title: string
  detail: string
  severity: RiskSeverity
  recommendedAction: string
  link?: string
}

interface CatalogProduct {
  name: string
  status: string
  commercial_priority?: number
  code_presence?: string
  evidence_status?: string
  pilot_status?: string
}

interface RiskData {
  opsScore: number
  opsGrade: string
  pendingApprovals: number
  activeBreaches: number
  risks: RiskItem[]
  approvalsAvailable: boolean
  breachesAvailable: boolean
}

// ── Risk Computation ──────────────────────────────────────────────────────────

function loadTopVentures(): CatalogProduct[] {
  try {
    const p = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(p, 'utf-8')
    const catalog = JSON.parse(raw) as { products: CatalogProduct[] }
    return catalog.products
  } catch {
    return []
  }
}

function buildOpsRisk(opsScore: number, opsGrade: string): RiskItem[] {
  const risks: RiskItem[] = []
  if (opsScore < 60) {
    risks.push({
      id: 'ops-score-critical',
      category: 'platform',
      title: 'Platform ops confidence critical',
      detail: `Ops score ${opsScore}/100 (${opsGrade}) — SLO compliance, error rates, or integration SLA is degraded.`,
      severity: 'critical',
      recommendedAction: 'Review Ops Score page for component breakdown. Escalate to engineering immediately.',
      link: '/ops-score',
    })
  } else if (opsScore < 80) {
    risks.push({
      id: 'ops-score-warn',
      category: 'platform',
      title: 'Platform ops health needs attention',
      detail: `Ops score ${opsScore}/100 (${opsGrade}) — below healthy threshold of 80.`,
      severity: 'high',
      recommendedAction: 'Check trend detection for degrading metrics. Monitor over 48h.',
      link: '/ops-score',
    })
  }
  return risks
}

function buildVentureRisks(products: CatalogProduct[]): RiskItem[] {
  const risks: RiskItem[] = []

  // Pilots active but no evidence pack
  const pilotsNoEvidence = products.filter(
    (p) => (p.pilot_status === 'active' || p.pilot_status === 'live') && p.evidence_status === 'none',
  )
  if (pilotsNoEvidence.length > 0) {
    for (const p of pilotsNoEvidence) {
      risks.push({
        id: `no-evidence-${p.name}`,
        category: 'venture',
        title: `${p.name}: pilot active, no evidence pack`,
        detail: 'Active pilot with no evidence pack is a governance and sales risk — can lose deal or fail audit.',
        severity: 'high',
        recommendedAction: 'Create evidence pack immediately. See /evidence-packs.',
        link: '/evidence-packs',
      })
    }
  }

  // Priority ≤2 ventures with code_presence = scaffold only
  const priorityGap = products.filter(
    (p) => (p.commercial_priority ?? 99) <= 2 && p.code_presence === 'scaffold',
  )
  for (const p of priorityGap) {
    risks.push({
      id: `code-gap-${p.name}`,
      category: 'venture',
      title: `${p.name}: SELL NOW priority but code is scaffold`,
      detail: 'Top-priority ventures with only scaffolded code cannot close sales or run demos.',
      severity: 'critical',
      recommendedAction: 'Prioritize building minimum viable product for this venture.',
      link: '/portfolio',
    })
  }

  // No active pilot for priority 1 venture
  const topNoPilot = products.filter(
    (p) => p.commercial_priority === 1 && p.pilot_status !== 'active' && p.pilot_status !== 'live',
  )
  for (const p of topNoPilot) {
    risks.push({
      id: `no-pilot-top-${p.name}`,
      category: 'venture',
      title: `${p.name}: #1 priority with no active pilot`,
      detail: 'No pilot running for top commercial priority venture. Revenue is not progressing.',
      severity: 'high',
      recommendedAction: 'Launch a prospect pilot immediately. See /revenue.',
      link: '/revenue',
    })
  }

  return risks
}

async function loadRiskData(): Promise<RiskData> {
  const products = loadTopVentures()

  // Ops score (sync — from env config)
  const opsResult = computeOpsScore({
    sloCompliancePct: Number(process.env.OPS_SLO_COMPLIANCE_PCT ?? '96'),
    errorDeltaPct: Number(process.env.OPS_ERROR_DELTA_PCT ?? '1.2'),
    integrationSlaPct: Number(process.env.OPS_INTEGRATION_SLA_PCT ?? '98.5'),
    dlqBacklogRatio: Number(process.env.OPS_DLQ_BACKLOG_RATIO ?? '0.1'),
    regressionSeverity: Number(process.env.OPS_REGRESSION_SEVERITY ?? '0'),
  })

  const [approvalsRes, breachesRes] = await Promise.allSettled([
    platformDb
      .select({ cnt: count().as('cnt') })
      .from(approvals)
      .where(eq(approvals.status, 'pending')),
    platformDb
      .select({ cnt: count().as('cnt') })
      .from(platformCostBudgetBreaches),
  ])

  const approvalsAvailable = approvalsRes.status === 'fulfilled'
  const breachesAvailable = breachesRes.status === 'fulfilled'

  const pendingApprovals = approvalsAvailable ? Number(approvalsRes.value[0]?.cnt ?? 0) : 0
  const activeBreaches = breachesAvailable ? Number(breachesRes.value[0]?.cnt ?? 0) : 0

  // Build risk list
  const risks: RiskItem[] = []

  // Platform risk
  risks.push(...buildOpsRisk(opsResult.score, opsResult.grade))

  // Venture risk
  risks.push(...buildVentureRisks(products))

  // Financial risk
  if (breachesAvailable && activeBreaches > 0) {
    risks.push({
      id: 'budget-breach',
      category: 'financial',
      title: `${activeBreaches} budget breach${activeBreaches > 1 ? 'es' : ''} recorded`,
      detail: 'Platform cost has exceeded budget thresholds. Check daily/monthly spend.',
      severity: activeBreaches >= 3 ? 'critical' : 'high',
      recommendedAction: 'Review /capital for breach detail. Identify and cut high-cost apps.',
      link: '/capital',
    })
  }

  // Governance risk
  if (approvalsAvailable && pendingApprovals >= 5) {
    risks.push({
      id: 'approval-backlog',
      category: 'governance',
      title: `${pendingApprovals} approvals stalled`,
      detail: 'Approval backlog creates governance debt and blocks ops teams.',
      severity: pendingApprovals >= 10 ? 'high' : 'medium',
      recommendedAction: 'Clear approval queue in /business/approvals today.',
      link: '/business/approvals',
    })
  }

  // Sort: critical first, then high, medium, low
  const severityOrder: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return {
    opsScore: opsResult.score,
    opsGrade: opsResult.grade,
    pendingApprovals,
    activeBreaches,
    risks,
    approvalsAvailable,
    breachesAvailable,
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function severityBadge(s: RiskSeverity) {
  if (s === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  if (s === 'high') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (s === 'medium') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function categoryBadge(c: string) {
  if (c === 'platform') return 'text-purple-600'
  if (c === 'venture') return 'text-blue-600'
  if (c === 'financial') return 'text-red-500'
  if (c === 'governance') return 'text-amber-600'
  return 'text-gray-500'
}

function opsGradeColor(g: string) {
  if (g === 'A') return 'text-emerald-600'
  if (g === 'B') return 'text-blue-600'
  if (g === 'C') return 'text-amber-500'
  return 'text-red-600'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RiskPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await loadRiskData()
  const criticalCount = data.risks.filter((r) => r.severity === 'critical').length
  const highCount = data.risks.filter((r) => r.severity === 'high').length
  const freshnessStatus = !data.approvalsAvailable && !data.breachesAvailable
    ? 'manual'
    : data.approvalsAvailable && data.breachesAvailable
      ? 'live'
      : 'daily sync'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <ShieldExclamationIcon className="h-8 w-8 text-gray-300" />
            Risk Center
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Platform · Venture · Financial · Governance — all risk in one view
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/ops-score" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Ops score <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link href="/audit-insights" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Audit insights <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
            freshness: {freshnessStatus}
          </span>
        </div>
      </div>

      {/* Risk Summary Banner */}
      {criticalCount > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <FireIcon className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">
              {criticalCount} critical risk{criticalCount > 1 ? 's' : ''} require immediate action
            </p>
            <p className="text-sm text-red-600">
              {highCount > 0 ? `Plus ${highCount} high-severity risk${highCount > 1 ? 's' : ''} to address this week.` : ''}
            </p>
          </div>
        </div>
      ) : highCount > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="font-semibold text-amber-800">
            {highCount} high-severity risk{highCount > 1 ? 's' : ''} — address this week
          </p>
        </div>
      ) : data.risks.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="font-semibold text-emerald-800">No active risks detected — platform healthy</p>
        </div>
      ) : null}

      {/* Risk Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ops Score</p>
          <p className={`text-2xl font-bold ${opsGradeColor(data.opsGrade)}`}>{data.opsScore}</p>
          <p className="text-xs text-gray-400 mt-1">Grade {data.opsGrade} · /100</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Critical Risks</p>
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {criticalCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">require immediate action</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Budget Breaches</p>
          <p className={`text-2xl font-bold ${data.activeBreaches > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {data.breachesAvailable ? data.activeBreaches : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{data.activeBreaches > 0 ? 'active' : 'all clear'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Approvals Stalled</p>
          <p className={`text-2xl font-bold ${data.pendingApprovals >= 5 ? 'text-amber-600' : 'text-gray-900'}`}>
            {data.approvalsAvailable ? data.pendingApprovals : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">pending approvals</p>
        </div>
      </div>

      {/* Risk Matrix */}
      {data.risks.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <EyeIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Active Risk Register</h2>
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {data.risks.length} item{data.risks.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {data.risks.map((risk) => (
              <div key={risk.id} className="px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${categoryBadge(risk.category)}`}>
                        {risk.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${severityBadge(risk.severity)}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{risk.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{risk.detail}</p>
                    <p className="text-xs text-blue-600 mt-2 font-medium">→ {risk.recommendedAction}</p>
                  </div>
                  {risk.link && (
                    <Link
                      href={risk.link}
                      className="shrink-0 text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mt-1"
                    >
                      View <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No risks detected across the platform</p>
          <p className="text-sm text-gray-400 mt-1">Keep monitoring — risks update as platform data changes.</p>
        </div>
      )}

      {/* Risk Definitions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-3">Risk Classification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="font-semibold text-red-600">Critical</span> — Action required today. Business continuity or revenue closing at risk.
          </div>
          <div>
            <span className="font-semibold text-amber-600">High</span> — Must be resolved this week. Will compound if ignored.
          </div>
          <div>
            <span className="font-semibold text-yellow-600">Medium</span> — Addressed in next sprint. Monitor for escalation.
          </div>
          <div>
            <span className="font-semibold text-gray-500">Low</span> — Logged for awareness. Revisit monthly.
          </div>
        </div>
      </div>

      {/* Related Links */}
      <div className="flex gap-4 flex-wrap text-sm">
        <Link href="/ops-score" className="text-gray-500 hover:text-gray-800">Ops Score</Link>
        <Link href="/trend-detection" className="text-gray-500 hover:text-gray-800">Trend Detection</Link>
        <Link href="/audit-insights" className="text-gray-500 hover:text-gray-800">Audit Insights</Link>
        <Link href="/capital" className="text-gray-500 hover:text-gray-800">Capital / Burn</Link>
        <Link href="/evidence-packs" className="text-gray-500 hover:text-gray-800">Evidence Packs</Link>
      </div>

      {/* Nav */}
      <div className="flex gap-3">
        <Link href="/execution" className="text-sm text-gray-500 hover:text-gray-900">← Execution</Link>
        <Link href="/governance" className="text-sm text-blue-600 hover:text-blue-800">Governance →</Link>
      </div>
    </div>
  )
}
