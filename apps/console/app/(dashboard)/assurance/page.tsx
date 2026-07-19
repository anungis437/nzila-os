/**
 * Nzila OS — Executive Assurance Dashboard
 * 5 KPI scores computed from real platform data:
 *   compliance, security, operations, cost, integration reliability.
 * Weighted overall score with letter grades.
 * @see @nzila/platform-assurance
 */
import { requireRole } from '@/lib/rbac'
import { gradeFromScore } from '@nzila/platform-assurance'
import { platformDb } from '@nzila/db/platform'
import { evidencePacks, closePeriods, platformIsolationAudits } from '@nzila/db/schema'
import { desc } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core/telemetry'
import {
  ShieldCheckIcon,
  CurrencyDollarIcon,
  CpuChipIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

const logger = createLogger('console.assurance')

// ── Score computation from real platform data ────────────────────────────

interface KpiScore {
  name: string
  value: number
  grade: string
  weight: number
  details: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

async function computeKpis(): Promise<{ kpis: KpiScore[]; overall: number }> {
  let packs: Array<typeof evidencePacks.$inferSelect> = []
  let periods: Array<typeof closePeriods.$inferSelect> = []
  let isolationScore = 0

  try {
    packs = await platformDb.select().from(evidencePacks)
  } catch (error) {
    logger.warn('assurance evidence packs load failed; using empty fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    const [latestIsolation] = await platformDb
      .select()
      .from(platformIsolationAudits)
      .orderBy(desc(platformIsolationAudits.auditedAt))
      .limit(1)
    isolationScore = Number(latestIsolation?.isolationScore ?? 0)
  } catch (error) {
    logger.warn('assurance isolation audit load failed; using zero fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    periods = await platformDb.select().from(closePeriods)
  } catch (error) {
    logger.warn('assurance close periods load failed; using empty fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const verifiedPacks = packs.filter((p) => p.status === 'verified').length
  const complianceValue = packs.length > 0 ? Math.round((verifiedPacks / packs.length) * 100) : 0

  const integrityPacks = packs.filter((p) => p.chainIntegrity === 'VERIFIED').length
  const securityValue = packs.length > 0
    ? Math.round((integrityPacks / packs.length) * 50 + isolationScore * 0.5)
    : Math.round(isolationScore)

  const closedPeriods = periods.filter((p) => p.status === 'closed').length
  const opsValue = periods.length > 0 ? Math.round((closedPeriods / periods.length) * 100) : 0

  const costValue = periods.length > 0
    ? Math.min(100, Math.round((closedPeriods / periods.length) * 80 + 20))
    : 0

  const uniqueEventTypes = new Set(packs.map((p) => p.eventType)).size
  const intValue = Math.min(100, uniqueEventTypes * 20)

  const kpis: KpiScore[] = [
    { name: 'Compliance', value: complianceValue, grade: gradeFromScore(complianceValue), weight: 25, details: `${verifiedPacks}/${packs.length} evidence packs verified`, icon: DocumentCheckIcon },
    { name: 'Security', value: securityValue, grade: gradeFromScore(securityValue), weight: 25, details: `${integrityPacks}/${packs.length} chain integrity, isolation ${isolationScore}%`, icon: ShieldCheckIcon },
    { name: 'Operations', value: opsValue, grade: gradeFromScore(opsValue), weight: 20, details: `${closedPeriods}/${periods.length} close periods completed`, icon: CpuChipIcon },
    { name: 'Cost', value: costValue, grade: gradeFromScore(costValue), weight: 15, details: `${periods.length} periods tracked`, icon: CurrencyDollarIcon },
    { name: 'Integration Reliability', value: intValue, grade: gradeFromScore(intValue), weight: 15, details: `${uniqueEventTypes} event types across evidence`, icon: ArrowPathIcon },
  ]

  const overall = Math.round(kpis.reduce((sum, k) => sum + k.value * (k.weight / 100), 0))
  return { kpis, overall }
}

// ── UI Helpers ────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A') return 'bg-green-50 text-green-700 border-green-200'
  if (grade === 'B') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  if (grade === 'C') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-red-50 text-red-700 border-red-200'
}

function KpiCard({ kpi }: { kpi: KpiScore }) {
  const Icon = kpi.icon
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm transition">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{kpi.name}</h3>
            <p className="text-xs text-gray-500">Weight: {kpi.weight}%</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${gradeColor(kpi.grade)}`}>
          {kpi.grade}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xl font-bold text-gray-900">{kpi.value}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${kpi.value >= 90 ? 'bg-green-500' : kpi.value >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${kpi.value}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{kpi.details}</p>
    </div>
  )
}

export default async function AssurancePage({
  searchParams,
}: { searchParams: Promise<{ mode?: string }> }) {
  await requireRole('platform_admin', 'studio_admin', 'analyst')
  const params = await searchParams
  const isExecutive = params.mode === 'executive'

  const { kpis, overall } = await computeKpis()
  const grade = gradeFromScore(overall)

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Executive Assurance Dashboard</h1>
          <p className="text-gray-500 mt-1">Weighted KPI scores computed from real platform data</p>
        </div>
        <a
          href="/api/assurance?download=true"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Export JSON
        </a>
      </div>

      {/* Overall Score Hero */}
      <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-200">Overall Assurance Score</p>
            <p className="text-5xl font-bold mt-2">{overall}/100</p>
            <p className="text-sm text-indigo-200 mt-2">
              Grade {grade} — Weighted across 5 dimensions
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-4 py-2 text-2xl font-bold rounded-xl ${grade === 'A' ? 'bg-green-500/20 text-green-200' : grade === 'B' ? 'bg-yellow-500/20 text-yellow-200' : 'bg-red-500/20 text-red-200'}`}>
              {grade}
            </span>
            <p className="text-xs text-indigo-300 mt-2">
              Compliance 25% · Security 25% · Ops 20% · Cost 15% · Integration 15%
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.name} kpi={kpi} />
        ))}
      </div>

      {/* Score Breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.name} className="flex items-center gap-2 py-2">
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${gradeColor(kpi.grade)}`}>{kpi.grade}</span>
              <span className="text-sm text-gray-700">{kpi.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{kpi.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
