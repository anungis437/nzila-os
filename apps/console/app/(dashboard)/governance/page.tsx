/**
 * Nzila OS — Governance Visibility
 *
 * Read-only transparency layer for platform governance status.
 * Displays: contract test version, CI run status, red-team status,
 * schema drift check, secret scan last run.
 *
 * Data pulled from CI artifacts or env-injected metadata.
 * Platform role only — no secrets exposed.
 */
import { requireRole } from '@/lib/rbac'
import {
  ShieldCheckIcon,
  BeakerIcon,
  BugAntIcon,
  CircleStackIcon,
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

interface GovernanceItem {
  label: string
  value: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  lastRun: string | null
  icon: React.ComponentType<{ className?: string }>
}

function getGovernanceItems(): GovernanceItem[] {
  return [
    {
      label: 'Contract Tests Version',
      value: process.env.CONTRACT_TEST_VERSION ?? process.env.GIT_SHA?.slice(0, 12) ?? 'unknown',
      status: process.env.CONTRACT_TEST_STATUS === 'pass' ? 'pass'
        : process.env.CONTRACT_TEST_STATUS === 'fail' ? 'fail' : 'unknown',
      lastRun: process.env.CONTRACT_TEST_LAST_RUN ?? null,
      icon: ShieldCheckIcon,
    },
    {
      label: 'Last CI Run Status',
      value: process.env.CI_STATUS ?? 'unknown',
      status: process.env.CI_STATUS === 'success' ? 'pass'
        : process.env.CI_STATUS === 'failure' ? 'fail' : 'unknown',
      lastRun: process.env.CI_LAST_RUN ?? null,
      icon: BeakerIcon,
    },
    {
      label: 'Red-Team Test Status',
      value: process.env.REDTEAM_STATUS ?? 'not configured',
      status: process.env.REDTEAM_STATUS === 'pass' ? 'pass'
        : process.env.REDTEAM_STATUS === 'fail' ? 'fail' : 'unknown',
      lastRun: process.env.REDTEAM_LAST_RUN ?? null,
      icon: BugAntIcon,
    },
    {
      label: 'Schema Drift Check',
      value: process.env.SCHEMA_DRIFT_STATUS ?? 'not configured',
      status: process.env.SCHEMA_DRIFT_STATUS === 'clean' ? 'pass'
        : process.env.SCHEMA_DRIFT_STATUS === 'drift' ? 'warn' : 'unknown',
      lastRun: process.env.SCHEMA_DRIFT_LAST_RUN ?? null,
      icon: CircleStackIcon,
    },
    {
      label: 'Secret Scan Last Run',
      value: process.env.SECRET_SCAN_STATUS ?? 'not configured',
      status: process.env.SECRET_SCAN_STATUS === 'clean' ? 'pass'
        : process.env.SECRET_SCAN_STATUS === 'found' ? 'fail' : 'unknown',
      lastRun: process.env.SECRET_SCAN_LAST_RUN ?? null,
      icon: LockClosedIcon,
    },
  ]
}

const statusConfig = {
  pass: {
    badge: 'bg-green-100 text-green-800',
    card: 'border-green-200 bg-green-50',
    icon: CheckCircleIcon,
    label: 'Pass',
  },
  warn: {
    badge: 'bg-amber-100 text-amber-800',
    card: 'border-amber-200 bg-amber-50',
    icon: ExclamationTriangleIcon,
    label: 'Warning',
  },
  fail: {
    badge: 'bg-red-100 text-red-800',
    card: 'border-red-200 bg-red-50',
    icon: XCircleIcon,
    label: 'Fail',
  },
  unknown: {
    badge: 'bg-gray-100 text-gray-600',
    card: 'border-gray-200 bg-gray-50',
    icon: ExclamationTriangleIcon,
    label: 'Unknown',
  },
}

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const items = getGovernanceItems()

  const passCount = items.filter((i) => i.status === 'pass').length
  const totalCount = items.length

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Governance</h1>
          <p className="text-gray-500 mt-1">
            Platform governance and compliance transparency layer
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            passCount === totalCount
              ? 'bg-green-100 text-green-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {passCount}/{totalCount} checks passing
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const config = statusConfig[item.status]
          return (
            <div
              key={item.label}
              className={`border rounded-xl p-5 ${config.card}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <item.icon className="h-5 w-5" />
                <h3 className="font-semibold text-sm text-gray-900">{item.label}</h3>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-lg font-bold text-gray-900 font-mono">{item.value}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}
                >
                  {config.label}
                </span>
              </div>
              {item.lastRun && (
                <p className="text-xs text-gray-500">
                  Last run: {item.lastRun}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 p-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">About Governance Checks</p>
        <p>
          Values are injected from CI/CD environment variables at deploy time.
          Set <code className="text-xs bg-gray-100 px-1 rounded">CONTRACT_TEST_VERSION</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">CI_STATUS</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">REDTEAM_STATUS</code>,{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">SCHEMA_DRIFT_STATUS</code>,{' '}
          and <code className="text-xs bg-gray-100 px-1 rounded">SECRET_SCAN_STATUS</code>{' '}
          in your deployment pipeline.
        </p>
      </div>
    </div>
  )
}
