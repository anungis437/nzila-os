/**
 * Nzila OS — Platform Health Panel
 *
 * Read-only system health dashboard — platform admin only.
 * Displays: DB health, worker queue depth, outbox backlog,
 * migration version, contract test hash, last deployment.
 *
 * No secrets exposed. All data from DB/env metadata.
 */
import { requireRole } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { automationCommands, zongaOutbox, nacpOutbox } from '@nzila/db/schema'
import { count, eq, sql, or } from 'drizzle-orm'
import {
  ServerIcon,
  QueueListIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  FingerPrintIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

interface HealthCheck {
  label: string
  status: 'healthy' | 'warning' | 'error'
  value: string
  icon: React.ComponentType<{ className?: string }>
}

async function gatherHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // 1. DB connection health
  try {
    await platformDb.execute(sql`SELECT 1 AS ping`)
    checks.push({
      label: 'Database Connection',
      status: 'healthy',
      value: 'Connected',
      icon: ServerIcon,
    })
  } catch {
    checks.push({
      label: 'Database Connection',
      status: 'error',
      value: 'Unreachable',
      icon: ServerIcon,
    })
  }

  // 2. Worker queue depth (pending + running automation commands)
  try {
    const [queueResult] = await platformDb
      .select({ depth: count().as('depth') })
      .from(automationCommands)
      .where(
        or(
          eq(automationCommands.status, 'pending'),
          eq(automationCommands.status, 'running'),
          eq(automationCommands.status, 'dispatched'),
        ),
      )

    const depth = queueResult?.depth ?? 0
    checks.push({
      label: 'Worker Queue Depth',
      status: depth > 100 ? 'warning' : 'healthy',
      value: `${depth} pending`,
      icon: QueueListIcon,
    })
  } catch {
    checks.push({
      label: 'Worker Queue Depth',
      status: 'error',
      value: 'Query failed',
      icon: QueueListIcon,
    })
  }

  // 3. Outbox event backlog (Zonga + NACP outboxes — pending status)
  try {
    const [zongaResult] = await platformDb
      .select({ total: count().as('total') })
      .from(zongaOutbox)
      .where(eq(zongaOutbox.status, 'pending'))

    const [nacpResult] = await platformDb
      .select({ total: count().as('total') })
      .from(nacpOutbox)
      .where(eq(nacpOutbox.status, 'pending'))

    const totalBacklog = (zongaResult?.total ?? 0) + (nacpResult?.total ?? 0)
    checks.push({
      label: 'Outbox Event Backlog',
      status: totalBacklog > 50 ? 'warning' : 'healthy',
      value: `${totalBacklog} pending`,
      icon: EnvelopeIcon,
    })
  } catch {
    checks.push({
      label: 'Outbox Event Backlog',
      status: 'error',
      value: 'Query failed',
      icon: EnvelopeIcon,
    })
  }

  // 4. Migration version (from env or DB metadata)
  const migrationVersion = process.env.MIGRATION_VERSION ?? 'latest'
  checks.push({
    label: 'Migration Version',
    status: 'healthy',
    value: migrationVersion,
    icon: ArrowPathIcon,
  })

  // 5. Contract test version hash
  const contractHash = process.env.CONTRACT_TEST_HASH ?? process.env.GIT_SHA?.slice(0, 12) ?? 'unknown'
  checks.push({
    label: 'Contract Test Hash',
    status: contractHash !== 'unknown' ? 'healthy' : 'warning',
    value: contractHash,
    icon: FingerPrintIcon,
  })

  // 6. Last deployment timestamp
  const deployTimestamp = process.env.DEPLOY_TIMESTAMP ?? process.env.BUILD_TIMESTAMP ?? 'not set'
  checks.push({
    label: 'Last Deployment',
    status: deployTimestamp !== 'not set' ? 'healthy' : 'warning',
    value: deployTimestamp,
    icon: ClockIcon,
  })

  return checks
}

const statusColors = {
  healthy: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const statusBadge = {
  healthy: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}

export default async function SystemHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const checks = await gatherHealthChecks()

  const overallHealthy = checks.every((c) => c.status === 'healthy')

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8 flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-1">
            Platform infrastructure status — read-only
          </p>
        </div>
        <span
          className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
            overallHealthy ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {overallHealthy ? 'All Systems Operational' : 'Attention Needed'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`border rounded-xl p-5 ${statusColors[check.status]}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <check.icon className="h-5 w-5" />
              <h3 className="font-semibold text-sm">{check.label}</h3>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{check.value}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[check.status]}`}
              >
                {check.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
