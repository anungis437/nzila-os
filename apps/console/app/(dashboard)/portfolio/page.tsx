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
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { getCapitalPriorityRows } from '@/lib/executive-intelligence'

export const dynamic = 'force-dynamic'

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

function directiveStyle(d: Directive): string {
  if (d === 'SELL NOW') return 'bg-emerald-100 text-emerald-700 font-bold'
  if (d === 'BUILD NEXT') return 'bg-blue-100 text-blue-700 font-semibold'
  if (d === 'MAINTAIN') return 'bg-gray-100 text-gray-500'
  if (d === 'HOLD') return 'bg-amber-100 text-amber-600'
  return 'bg-red-100 text-red-600 font-bold'
}

function codeBar(c?: string) {
  if (c === 'full') return <span className="text-emerald-600 font-semibold text-xs">●●●</span>
  if (c === 'partial') return <span className="text-amber-500 font-semibold text-xs">●●○</span>
  if (c === 'scaffold') return <span className="text-gray-400 text-xs">●○○</span>
  return <span className="text-gray-300 text-xs">○○○</span>
}

function evidenceDot(e?: string) {
  if (e === 'complete') return <span className="text-emerald-600 text-xs font-semibold">complete</span>
  if (e === 'partial') return <span className="text-amber-500 text-xs">partial</span>
  return <span className="text-red-400 text-xs">none</span>
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
  const capitalRows = await getCapitalPriorityRows()
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

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

      {/* Full Venture Table */}
      {products.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">All Ventures</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by commercial priority. Click a venture to navigate to its docs.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-6">#</th>
                  <th className="px-4 py-3">Venture</th>
                  <th className="px-4 py-3">Capital Score</th>
                  <th className="px-4 py-3">Capital Action</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Directive</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3 hidden md:table-cell">GA Gates</th>
                  <th className="px-4 py-3 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p, i) => (
                  <tr key={p.name} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs font-mono text-gray-300">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900 capitalize">{p.name.replace(/-/g, ' ')}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.priorityLabel}</span>
                      </div>
                      {p.value_prop && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.value_prop}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-900">{p.capitalPriorityScore ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className={`text-xs px-2 py-1 rounded-full ${p.capitalAction === 'Double down' ? 'bg-emerald-100 text-emerald-700 font-semibold' : p.capitalAction === 'Maintain' ? 'bg-blue-100 text-blue-700 font-semibold' : p.capitalAction === 'Cut review' ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                          {p.capitalAction}
                        </span>
                        {p.capitalRationale && <p className="text-xs text-gray-400 mt-1 max-w-xs">{p.capitalRationale}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500 capitalize">{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${directiveStyle(p.directive)}`}>
                        {p.directive}
                      </span>
                    </td>
                    <td className="px-4 py-3">{codeBar(p.code_presence)}</td>
                    <td className="px-4 py-3">{evidenceDot(p.evidence_status)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono text-gray-400">{p.ga_gate_count ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.docs_entrypoint ? (
                        <Link href={`/docs`} className="text-blue-400 hover:text-blue-600">
                          <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  )
}
