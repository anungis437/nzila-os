/**
 * Nzila OS — Platform Overview (Control Plane)
 *
 * Executive control plane view across all apps.
 * Platform admins see global numbers; org admins see org-scoped metrics.
 */
import { currentUser } from '@nzila/platform-auth/entra/server'
import { getUserRole } from '@/lib/rbac'
import {
  getPlatformOverviewMetrics,
  getOrgOverviewMetrics,
} from '@nzila/platform-metrics/platform'
import {
  BuildingOffice2Icon,
  ShieldCheckIcon,
  CpuChipIcon,
  AcademicCapIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  TagIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// System version from root package.json (build-time constant)
const SYSTEM_VERSION = process.env.npm_package_version ?? '0.1.0'

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
}

function MetricCard({ label, value, icon: Icon, color }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className={`inline-flex p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default async function PlatformOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; orgId?: string }>
}) {
  const _user = await currentUser()
  const role = await getUserRole()
  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const isPlatformAdmin = role === 'platform_admin' || role === 'studio_admin'

  // Determine scope: platform admin sees global, org admin sees scoped
  const orgId = params.orgId

  if (isPlatformAdmin && !orgId) {
    // Platform-wide view
    const metrics = await getPlatformOverviewMetrics(SYSTEM_VERSION)

    return (
      <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-gray-500 mt-1">
            Global control plane — all orgs, all apps
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total Orgs"
            value={metrics.totalOrgs}
            icon={BuildingOffice2Icon}
            color="bg-blue-50 text-blue-600"
          />
          <MetricCard
            label="Total Audit Events"
            value={metrics.totalAuditEvents.toLocaleString()}
            icon={ShieldCheckIcon}
            color="bg-amber-50 text-amber-600"
          />
          <MetricCard
            label="Background Jobs Processed"
            value={metrics.totalBackgroundJobs.toLocaleString()}
            icon={CpuChipIcon}
            color="bg-purple-50 text-purple-600"
          />
          <MetricCard
            label="Active NACP Sessions"
            value={metrics.activeSessions}
            icon={AcademicCapIcon}
            color="bg-green-50 text-green-600"
          />
          <MetricCard
            label="Revenue Events (Zonga)"
            value={metrics.revenueEventsProcessed.toLocaleString()}
            icon={CurrencyDollarIcon}
            color="bg-emerald-50 text-emerald-600"
          />
          <MetricCard
            label="Claims (UnionEyes)"
            value={metrics.claimsProcessed.toLocaleString()}
            icon={UserGroupIcon}
            color="bg-indigo-50 text-indigo-600"
          />
          <MetricCard
            label="Quotes Generated (Shop)"
            value={metrics.quotesGenerated.toLocaleString()}
            icon={DocumentTextIcon}
            color="bg-rose-50 text-rose-600"
          />
          <MetricCard
            label="System Version"
            value={metrics.systemVersion}
            icon={TagIcon}
            color="bg-gray-100 text-gray-600"
          />
        </div>
      </div>
    )
  }

  // Org-scoped view (org admin or platform admin with orgId param)
  if (!orgId) {
    return (
      <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-gray-500 mt-1">
            Organization-scoped view
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <BuildingOffice2Icon className="h-8 w-8 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">Select an Organization</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Choose an organization to view its metrics, or contact your platform
            administrator for global access.
          </p>
          <p className="text-xs text-gray-400">
            Append <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600">?orgId=your-org-id</code> to the URL to view organization-specific metrics.
          </p>
        </div>
      </div>
    )
  }

  const metrics = await getOrgOverviewMetrics(orgId)

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Org Overview</h1>
        <p className="text-gray-500 mt-1">
          Organization-scoped metrics
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Audit Events"
          value={metrics.totalAuditEvents.toLocaleString()}
          icon={ShieldCheckIcon}
          color="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Background Jobs"
          value={metrics.totalBackgroundJobs.toLocaleString()}
          icon={CpuChipIcon}
          color="bg-purple-50 text-purple-600"
        />
        <MetricCard
          label="Active Sessions"
          value={metrics.activeSessions}
          icon={AcademicCapIcon}
          color="bg-green-50 text-green-600"
        />
        <MetricCard
          label="Revenue Events"
          value={metrics.revenueEventsProcessed.toLocaleString()}
          icon={CurrencyDollarIcon}
          color="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Claims Processed"
          value={metrics.claimsProcessed.toLocaleString()}
          icon={UserGroupIcon}
          color="bg-indigo-50 text-indigo-600"
        />
        <MetricCard
          label="Quotes Generated"
          value={metrics.quotesGenerated.toLocaleString()}
          icon={DocumentTextIcon}
          color="bg-rose-50 text-rose-600"
        />
      </div>
    </div>
  )
}
