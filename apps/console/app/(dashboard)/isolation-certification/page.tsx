/**
 * Nzila OS — Isolation Certification Dashboard
 *
 * Displays isolation audit results: score, violations, and last audit run.
 * Score computed deterministically. Failures visible but not auto-fixable.
 *
 * @see @nzila/platform-isolation
 */
import { requireRole } from '@/lib/rbac'
import { runIsolationAudit } from '@nzila/platform-isolation'
import {
  ShieldCheckIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

const severityColors = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

const severityBadge = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
}

export default async function IsolationCertificationPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const audit = await runIsolationAudit()

  const scoreColor =
    audit.isolationScore >= 90
      ? 'text-green-600'
      : audit.isolationScore >= 70
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Isolation Certification</h1>
        <p className="text-gray-500 mt-1">
          Platform isolation audit — RLS enforcement, org scoping, and data boundary verification
        </p>
      </div>

      {/* Score overview */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-500">Isolation Score</p>
          </div>
          <p className={`text-4xl font-bold ${scoreColor}`}>
            {audit.isolationScore}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <p className="text-sm text-gray-500">Checks Passed</p>
          </div>
          <p className="text-4xl font-bold text-gray-900">
            {audit.passedChecks}/{audit.totalChecks}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-gray-500">Violations</p>
          </div>
          <p className="text-4xl font-bold text-gray-900">{audit.violations.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-500">Last Audit</p>
          </div>
          <p className="text-sm font-mono text-gray-700">{audit.lastAuditRun}</p>
        </div>
      </div>

      {/* Violations list */}
      {audit.violations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Violations</h2>
          {audit.violations.map((v, i) => (
            <div
              key={i}
              className={`border rounded-xl p-4 ${severityColors[v.severity]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{v.check}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[v.severity]}`}
                >
                  {v.severity}
                </span>
              </div>
              <p className="text-sm">{v.description}</p>
              {v.resource && (
                <p className="text-xs mt-1 opacity-75">Resource: {v.resource}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {audit.violations.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-semibold">All isolation checks passed</p>
          <p className="text-green-600 text-sm mt-1">
            No cross-org data leakage detected
          </p>
        </div>
      )}
    </div>
  )
}
