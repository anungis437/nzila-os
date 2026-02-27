/**
 * Nzila OS — Scale Simulation Mode
 *
 * Pure computational projection — does NOT mutate real data.
 * Simulates 100 orgs, 10K claims, 50K revenue events, 5K background jobs.
 * Shows projected DB load, worker saturation, and SLA degradation risk.
 */
import { requireRole } from '@/lib/rbac'
import {
  ServerStackIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Simulation parameters ───────────────────────────────────────────────────

const SIM_ORGS = 100
const SIM_CLAIMS = 10_000
const SIM_REVENUE_EVENTS = 50_000
const SIM_BACKGROUND_JOBS = 5_000

// ── Pure computation — no side effects ──────────────────────────────────────

interface SimulationResult {
  dbConnectionsRequired: number
  dbConnectionsAvailable: number
  dbLoadPercentage: number
  estimatedQPS: number
  workerConcurrency: number
  workerSaturationPct: number
  avgClaimProcessingMs: number
  avgRevenueEventMs: number
  projectedP99Ms: number
  slaDegradationRisk: 'low' | 'medium' | 'high' | 'critical'
  totalRowsProjected: number
  storageEstimateGb: number
}

function runProjection(): SimulationResult {
  // Connection pool modeling
  const connectionsPerOrg = 2 // avg concurrent connections per active org
  const dbConnectionsRequired = SIM_ORGS * connectionsPerOrg
  const dbConnectionsAvailable = 100 // typical PG pool max
  const dbLoadPercentage = Math.min(
    (dbConnectionsRequired / dbConnectionsAvailable) * 100,
    100,
  )

  // QPS estimation
  const requestsPerClaimLifecycle = 8 // create, update, resolve, audit, etc.
  const requestsPerRevenueEvent = 3 // create, process, reconcile
  const requestsPerJob = 2 // dispatch + completion
  const totalRequests =
    SIM_CLAIMS * requestsPerClaimLifecycle +
    SIM_REVENUE_EVENTS * requestsPerRevenueEvent +
    SIM_BACKGROUND_JOBS * requestsPerJob
  const timeWindowSeconds = 3600 // simulate 1 hour window
  const estimatedQPS = Math.round(totalRequests / timeWindowSeconds)

  // Worker modeling
  const workerConcurrency = 10 // max concurrent workers
  const avgJobDurationMs = 250
  const jobsPerSecondPerWorker = 1000 / avgJobDurationMs
  const maxJobsPerSecond = workerConcurrency * jobsPerSecondPerWorker
  const requiredJobsPerSecond = SIM_BACKGROUND_JOBS / timeWindowSeconds
  const workerSaturationPct = Math.min(
    (requiredJobsPerSecond / maxJobsPerSecond) * 100,
    100,
  )

  // Latency projections
  const baseClaimMs = 45
  const baseRevenueMs = 30
  const loadMultiplier = 1 + dbLoadPercentage / 100
  const avgClaimProcessingMs = Math.round(baseClaimMs * loadMultiplier)
  const avgRevenueEventMs = Math.round(baseRevenueMs * loadMultiplier)
  const projectedP99Ms = Math.round(avgClaimProcessingMs * 4.5) // P99 ~ 4.5x avg

  // SLA degradation risk
  const slaDegradationRisk: SimulationResult['slaDegradationRisk'] =
    projectedP99Ms > 2000
      ? 'critical'
      : projectedP99Ms > 1000
        ? 'high'
        : projectedP99Ms > 500
          ? 'medium'
          : 'low'

  // Storage estimation
  const avgRowBytes = 512
  const totalRowsProjected =
    SIM_CLAIMS + SIM_REVENUE_EVENTS + SIM_BACKGROUND_JOBS + SIM_ORGS * 50 // 50 misc rows per org
  const storageEstimateGb = Math.round(
    (totalRowsProjected * avgRowBytes) / (1024 * 1024 * 1024) * 100,
  ) / 100

  return {
    dbConnectionsRequired,
    dbConnectionsAvailable,
    dbLoadPercentage: Math.round(dbLoadPercentage * 100) / 100,
    estimatedQPS,
    workerConcurrency,
    workerSaturationPct: Math.round(workerSaturationPct * 100) / 100,
    avgClaimProcessingMs,
    avgRevenueEventMs,
    projectedP99Ms,
    slaDegradationRisk,
    totalRowsProjected,
    storageEstimateGb,
  }
}

// ── UI ──────────────────────────────────────────────────────────────────────

const riskColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle?: string
}

function MetricCard({ label, value, icon: Icon, color, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className={`inline-flex p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default async function ScaleSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'

  // Pure computation — no DB mutation
  const sim = runProjection()

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Scale Simulation</h1>
        <p className="text-gray-500 mt-1">
          Computational projection — {SIM_ORGS.toLocaleString()} orgs,{' '}
          {SIM_CLAIMS.toLocaleString()} claims,{' '}
          {SIM_REVENUE_EVENTS.toLocaleString()} revenue events,{' '}
          {SIM_BACKGROUND_JOBS.toLocaleString()} jobs
        </p>
        <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
          Read-only simulation — no real data mutated
        </span>
      </div>

      {/* SLA Risk */}
      <div className="mb-6">
        <span
          className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${riskColors[sim.slaDegradationRisk]}`}
        >
          SLA Degradation Risk: {sim.slaDegradationRisk.toUpperCase()}
        </span>
      </div>

      {/* Simulation cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <MetricCard
          label="DB Connections"
          value={`${sim.dbConnectionsRequired}/${sim.dbConnectionsAvailable}`}
          icon={ServerStackIcon}
          color={sim.dbLoadPercentage > 80 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}
          subtitle={`${sim.dbLoadPercentage}% load`}
        />
        <MetricCard
          label="Estimated QPS"
          value={sim.estimatedQPS.toLocaleString()}
          icon={CpuChipIcon}
          color="bg-purple-50 text-purple-600"
          subtitle="Queries per second"
        />
        <MetricCard
          label="Worker Saturation"
          value={`${sim.workerSaturationPct}%`}
          icon={QueueListIcon}
          color={sim.workerSaturationPct > 80 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
          subtitle={`${sim.workerConcurrency} concurrent workers`}
        />
        <MetricCard
          label="Projected P99"
          value={`${sim.projectedP99Ms}ms`}
          icon={ExclamationTriangleIcon}
          color={sim.projectedP99Ms > 1000 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
        />
        <MetricCard
          label="Total Rows"
          value={sim.totalRowsProjected.toLocaleString()}
          icon={DocumentTextIcon}
          color="bg-gray-100 text-gray-600"
          subtitle={`~${sim.storageEstimateGb} GB storage`}
        />
        <MetricCard
          label="Simulated Orgs"
          value={SIM_ORGS}
          icon={BuildingOffice2Icon}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Latency projections */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Latency Projections</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-6 py-3 font-medium">Workload</th>
              <th className="px-6 py-3 font-medium">Volume</th>
              <th className="px-6 py-3 font-medium">Avg Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            <tr>
              <td className="px-6 py-3">Claims Processing</td>
              <td className="px-6 py-3">{SIM_CLAIMS.toLocaleString()}</td>
              <td className="px-6 py-3">{sim.avgClaimProcessingMs}ms</td>
            </tr>
            <tr>
              <td className="px-6 py-3">Revenue Events</td>
              <td className="px-6 py-3">{SIM_REVENUE_EVENTS.toLocaleString()}</td>
              <td className="px-6 py-3">{sim.avgRevenueEventMs}ms</td>
            </tr>
            <tr>
              <td className="px-6 py-3">Background Jobs</td>
              <td className="px-6 py-3">{SIM_BACKGROUND_JOBS.toLocaleString()}</td>
              <td className="px-6 py-3">{Math.round(1000 / (1000 / 250))}ms</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
