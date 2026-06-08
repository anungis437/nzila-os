/**
 * Nzila OS — Portfolio Venture Allocator
 *
 * Zone 2: PORTFOLIO — One view for all 17 ventures.
 * Answers: What is the current directive for each venture?
 *          Which ventures deserve founder time and capital?
 *          What is the portfolio-level maturity story?
 *
 * Data: product-catalog.json (read from filesystem — server component)
 * Supplement: pilotDefinitions, orgs counts from DB
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { pilotDefinitions, orgs } from '@nzila/db/schema'
import { count, eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import {
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { getAttributionDiagnostics, getCapitalPriorityRows } from '@/lib/executive-intelligence'
import { CommandPageShell } from '@/components/command-page-shell'
import { PortfolioWidgets, type PortfolioOpsProduct } from './_components/portfolio-widgets'
import { createLogger } from '@nzila/os-core/telemetry'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.portfolio')

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  name: string
  id?: string
  status: string
  type: string
  description: string
  value_prop?: string
  commercial_priority?: number
  code_presence?: string
  evidence_status?: string
  docs_entrypoint?: string
  ga_gate_count?: number
  contract_test_count?: number
}

interface ProductCatalog {
  products: CatalogProduct[]
  schema_version: string
}

type Directive = 'SELL NOW' | 'BUILD NEXT' | 'MAINTAIN' | 'HOLD' | 'CUT'

interface VentureRow extends CatalogProduct {
  directive: Directive
  priorityLabel: string
  capitalPriorityScore?: number
  capitalAction?: string
  capitalRationale?: string
}

// ── Logic ─────────────────────────────────────────────────────────────────────

function resolveDirective(p: CatalogProduct): Directive {
  const priority = p.commercial_priority ?? 99
  const status = p.status
  if (status === 'pilot' && priority <= 2) return 'SELL NOW'
  if (priority <= 4 && (status === 'pilot' || status === 'internal')) return 'BUILD NEXT'
  if (status === 'internal' && priority === 3) return 'MAINTAIN'
  if (priority >= 5) return 'HOLD'
  return 'HOLD'
}

function priorityLabel(p?: number): string {
  if (p === 1) return '#1 — Anchor'
  if (p === 2) return '#2 — Growth'
  if (p === 3) return '#3 — Build'
  if (p === 4) return '#4 — Pipeline'
  return '—'
}

function loadCatalog(): { products: VentureRow[]; version: string } {
  try {
    const catalogPath = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(catalogPath, 'utf-8')
    const catalog = JSON.parse(raw) as ProductCatalog
    const products: VentureRow[] = catalog.products.map((p) => ({
      ...p,
      directive: resolveDirective(p),
      priorityLabel: priorityLabel(p.commercial_priority),
    }))
    // Sort: priority ASC (nulls last), then name
    products.sort((a, b) => {
      const pa = a.commercial_priority ?? 99
      const pb = b.commercial_priority ?? 99
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name)
    })
    return { products, version: catalog.schema_version ?? 'unknown' }
  } catch {
    return { products: [], version: 'error' }
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PortfolioPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { products, version } = loadCatalog()
  const freshnessStatus = products.length > 0 ? 'daily sync' : 'stale'
  const [capitalRows, attribution] = await Promise.all([
    getCapitalPriorityRows().catch((error) => {
      logger.warn('capital priority rows load failed; returning empty fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }),
    getAttributionDiagnostics().catch((error) => {
      logger.warn('attribution diagnostics load failed; returning empty fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        quoteAttributionRate: 0,
        invoiceAttributionRate: 0,
        unattributedPipelineUsd: 0,
        unattributedPaidRevenueUsd: 0,
        unattributedQuoteCount: 0,
        unattributedPaidInvoiceCount: 0,
        sampleUnattributedQuotes: [],
        sampleUnattributedInvoices: [],
      }
    }),
  ])
  const capitalByVenture = new Map(capitalRows.map((row) => [row.ventureId, row]))

  for (const product of products) {
    const capital = capitalByVenture.get(product.id ?? product.name)
    product.capitalPriorityScore = capital?.score ?? 0
    product.capitalAction = capital?.action ?? 'Hold'
    product.capitalRationale = capital?.rationale ?? undefined
  }

  products.sort((left, right) => {
    const leftScore = left.capitalPriorityScore ?? 0
    const rightScore = right.capitalPriorityScore ?? 0
    if (leftScore !== rightScore) return rightScore - leftScore
    const leftPriority = left.commercial_priority ?? 99
    const rightPriority = right.commercial_priority ?? 99
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return left.name.localeCompare(right.name)
  })

  // Pilot orgs count from DB (conservative)
  let activePilotCount = 0
  let totalOrgs = 0
  try {
    const [pilotRes, orgRes] = await Promise.all([
      platformDb
        .select({ cnt: count() })
        .from(pilotDefinitions)
        .where(eq(pilotDefinitions.status, 'active')),
      platformDb.select({ cnt: count() }).from(orgs),
    ])
    activePilotCount = Number(pilotRes[0]?.cnt ?? 0)
    totalOrgs = Number(orgRes[0]?.cnt ?? 0)
  } catch { /* DB not available */ }

  const doubleDown = products.filter((p) => p.capitalAction === 'Double down')
  const maintainCapital = products.filter((p) => p.capitalAction === 'Maintain')
  const hold = products.filter((p) => p.capitalAction === 'Hold')
  const cutReview = products.filter((p) => p.capitalAction === 'Cut review')

  const opsProductsRaw: PortfolioOpsProduct[] | null = null
  const opsProducts: PortfolioOpsProduct[] = opsProductsRaw ?? [
    { key: 'union_eyes', label: 'Union Eyes', revenueScore: 85, closeabilityScore: 75, supportBurden: 30, founderEnergy: 40, strategicFit: 90, marketPull: 80, buildMaturity: 70, recommendation: 'double_down', recommendationNote: 'Anchor product. COSATU + union segment. Double down on sales.' },
    { key: 'flow', label: 'Flow', revenueScore: 70, closeabilityScore: 60, supportBurden: 20, founderEnergy: 30, strategicFit: 75, marketPull: 65, buildMaturity: 80, recommendation: 'maintain', recommendationNote: 'Clean product. Low burden. Maintain and keep pipeline warm.' },
    { key: 'faircase', label: 'FairCase', revenueScore: 60, closeabilityScore: 55, supportBurden: 70, founderEnergy: 60, strategicFit: 65, marketPull: 50, buildMaturity: 55, recommendation: 'incubate', recommendationNote: 'High support burden this quarter. Invest in quality before scaling.' },
    { key: 'agrimo', label: 'Agrimo', revenueScore: 80, closeabilityScore: 45, supportBurden: 50, founderEnergy: 55, strategicFit: 70, marketPull: 70, buildMaturity: 50, recommendation: 'incubate', recommendationNote: 'Strong market pull but incomplete build. Hold cadence at current client.' },
    { key: 'zonga', label: 'Zonga', revenueScore: 65, closeabilityScore: 40, supportBurden: 45, founderEnergy: 50, strategicFit: 60, marketPull: 55, buildMaturity: 40, recommendation: 'incubate', recommendationNote: 'Pilot stalled. Need to unblock onboarding before next sale.' },
    { key: 'platform', label: 'Platform', revenueScore: 40, closeabilityScore: 20, supportBurden: 15, founderEnergy: 25, strategicFit: 95, marketPull: 30, buildMaturity: 85, recommendation: 'maintain', recommendationNote: 'Critical infrastructure. Maintain. Not a revenue product.' },
  ]

  return (
    <CommandPageShell as="div" className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BuildingOffice2Icon className="h-8 w-8 text-gray-300" />
            Portfolio
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {products.length} ventures · {activePilotCount} active pilots · {totalOrgs} platform orgs
          </p>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          catalog {version}
        </div>
        <div className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full ml-2">
          freshness: {freshnessStatus}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'DOUBLE DOWN', count: doubleDown.length, color: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
          { label: 'MAINTAIN', count: maintainCapital.length, color: 'border-blue-400 text-blue-700 bg-blue-50' },
          { label: 'HOLD', count: hold.length, color: 'border-gray-300 text-gray-600 bg-gray-50' },
          { label: 'CUT REVIEW', count: cutReview.length, color: 'border-red-300 text-red-600 bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border-2 p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-semibold mt-1 tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {capitalRows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Capital Priority Engine V2</h2>
              <p className="text-xs text-gray-400 mt-1">Revenue traction, pipeline proxy, founder efficiency, delivery confidence, risk burden, and capital intensity.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {capitalRows.slice(0, 3).map((row, index) => (
              <div key={row.ventureId} className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-mono text-gray-400">#{index + 1}</p>
                <p className="text-lg font-bold text-gray-900 capitalize mt-1">{row.ventureName.replace(/-/g, ' ')}</p>
                <p className="text-sm text-gray-500 mt-1">Score {row.score} · {row.action}</p>
                <p className="text-sm text-gray-700 mt-3">{row.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Attribution Health</h2>
            <p className="text-xs text-gray-400 mt-1">Commerce telemetry coverage feeding the capital scoring engine.</p>
          </div>
          <div className="text-xs text-gray-500">
            Target: &gt;95% quote and paid invoice attribution
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500">Quote attribution</p>
            <p className="text-lg font-semibold text-gray-900">{Math.round(attribution.quoteAttributionRate * 100)}%</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500">Paid invoice attribution</p>
            <p className="text-lg font-semibold text-gray-900">{Math.round(attribution.invoiceAttributionRate * 100)}%</p>
          </div>
          <div className="rounded-lg border border-amber-200 p-3 bg-amber-50">
            <p className="text-xs text-amber-700">Unattributed pipeline</p>
            <p className="text-lg font-semibold text-amber-900">${attribution.unattributedPipelineUsd.toLocaleString()}</p>
            <p className="text-[11px] text-amber-700 mt-1">{attribution.unattributedQuoteCount} quotes</p>
          </div>
          <div className="rounded-lg border border-amber-200 p-3 bg-amber-50">
            <p className="text-xs text-amber-700">Unattributed paid revenue</p>
            <p className="text-lg font-semibold text-amber-900">${attribution.unattributedPaidRevenueUsd.toLocaleString()}</p>
            <p className="text-[11px] text-amber-700 mt-1">{attribution.unattributedPaidInvoiceCount} invoices</p>
          </div>
        </div>

        {(attribution.sampleUnattributedQuotes.length > 0 || attribution.sampleUnattributedInvoices.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Top unattributed quotes</p>
              {attribution.sampleUnattributedQuotes.length === 0 ? (
                <p className="text-xs text-gray-500">None</p>
              ) : (
                <ul className="space-y-1 text-xs text-gray-700">
                  {attribution.sampleUnattributedQuotes.map((row) => (
                    <li key={row.ref} className="flex items-center justify-between gap-2">
                      <span className="truncate">{row.ref}</span>
                      <span className="font-mono">${Math.round(row.totalUsd).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Top unattributed paid invoices</p>
              {attribution.sampleUnattributedInvoices.length === 0 ? (
                <p className="text-xs text-gray-500">None</p>
              ) : (
                <ul className="space-y-1 text-xs text-gray-700">
                  {attribution.sampleUnattributedInvoices.map((row) => (
                    <li key={row.ref} className="flex items-center justify-between gap-2">
                      <span className="truncate">{row.ref}</span>
                      <span className="font-mono">${Math.round(row.totalUsd).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Unified paginated widgets */}
      {products.length > 0 ? (
        <PortfolioWidgets products={products} opsProducts={opsProducts} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Product catalog not found</p>
            <p className="text-sm text-amber-600">Expected: <code>governance/portfolio/product-catalog.json</code></p>
          </div>
        </div>
      )}

      {/* Decision Framework */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-3">Allocation Framework</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-semibold text-emerald-700 mb-1">SELL NOW</p>
            <p className="text-gray-500 text-xs">Pilot-stage. Revenue calls this week. Founder &gt;30% time here.</p>
          </div>
          <div>
            <p className="font-semibold text-blue-700 mb-1">BUILD NEXT</p>
            <p className="text-gray-500 text-xs">Strong foundation. Schedule productisation. 20% founder time.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-600 mb-1">MAINTAIN</p>
            <p className="text-gray-500 text-xs">Internal ops value. Do not invest. Keep stable. 5% time max.</p>
          </div>
          <div>
            <p className="font-semibold text-amber-600 mb-1">HOLD / CUT</p>
            <p className="text-gray-500 text-xs">No traction proof. Freeze spend. Review in 90 days.</p>
          </div>
        </div>
      </div>

      {/* Nav away */}
      <div className="flex gap-3">
        <Link href="/today" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Today
        </Link>
        <Link href="/revenue" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          Revenue pipeline →
        </Link>
      </div>
    </CommandPageShell>
  )
}
