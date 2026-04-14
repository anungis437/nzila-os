/**
 * Nzila OS — Sovereign Deployment Profile View
 *
 * Displays deployment profile: Managed, Sovereign, or Hybrid.
 * Shows data residency, update model, patch cadence, responsibility matrix.
 * Shows egress allowlist enforcement status for sovereign profiles.
 * Role-restricted. No deployment secrets exposed.
 */
import { requireRole } from '@/lib/rbac'
import {
  CloudIcon,
  ServerIcon,
  ArrowsRightLeftIcon,
  GlobeAltIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  NoSymbolIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Deployment profiles (deterministic, no secrets) ─────────────────────────

interface DeploymentProfile {
  name: string
  type: 'managed' | 'sovereign' | 'hybrid'
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
  dataResidency: string
  updateModel: string
  patchCadence: string
  responsibilities: { area: string; owner: string }[]
}

const PROFILES: DeploymentProfile[] = [
  {
    name: 'Managed (Nzila-operated)',
    type: 'managed',
    icon: CloudIcon,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    description:
      'Fully hosted by Nzila. Infrastructure, updates, and security are managed centrally.',
    dataResidency: 'Nzila Cloud (multi-region)',
    updateModel: 'Continuous deployment — zero-downtime rolling updates',
    patchCadence: 'Security patches within 24h; feature releases bi-weekly',
    responsibilities: [
      { area: 'Infrastructure', owner: 'Nzila Platform Team' },
      { area: 'Security Patches', owner: 'Nzila Platform Team' },
      { area: 'Data Backups', owner: 'Nzila Platform Team' },
      { area: 'Monitoring', owner: 'Nzila Platform Team' },
      { area: 'App Configuration', owner: 'Customer' },
      { area: 'User Management', owner: 'Customer' },
    ],
  },
  {
    name: 'Sovereign (On-Prem)',
    type: 'sovereign',
    icon: ServerIcon,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    description:
      'Customer-operated. Full data sovereignty. Nzila provides artifacts and support.',
    dataResidency: 'Customer data center — full sovereignty',
    updateModel: 'Release artifacts provided; customer applies at own cadence',
    patchCadence: 'Security advisories within 24h; patches released same week',
    responsibilities: [
      { area: 'Infrastructure', owner: 'Customer' },
      { area: 'Security Patches', owner: 'Customer (with Nzila advisories)' },
      { area: 'Data Backups', owner: 'Customer' },
      { area: 'Monitoring', owner: 'Customer' },
      { area: 'App Configuration', owner: 'Customer' },
      { area: 'User Management', owner: 'Customer' },
    ],
  },
  {
    name: 'Hybrid',
    type: 'hybrid',
    icon: ArrowsRightLeftIcon,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    description:
      'Control plane managed by Nzila; data plane in customer environment. Split responsibility.',
    dataResidency: 'Control plane: Nzila Cloud | Data plane: Customer environment',
    updateModel: 'Control plane: continuous | Data plane: coordinated releases',
    patchCadence: 'Control plane: immediate | Data plane: customer-scheduled',
    responsibilities: [
      { area: 'Control Plane Infra', owner: 'Nzila Platform Team' },
      { area: 'Data Plane Infra', owner: 'Customer' },
      { area: 'Security Patches (Control)', owner: 'Nzila Platform Team' },
      { area: 'Security Patches (Data)', owner: 'Customer' },
      { area: 'Data Backups', owner: 'Customer' },
      { area: 'Monitoring (Control)', owner: 'Nzila Platform Team' },
      { area: 'Monitoring (Data)', owner: 'Customer' },
    ],
  },
]

const _profileIcons = {
  dataResidency: GlobeAltIcon,
  updateModel: ArrowPathIcon,
  patchCadence: ShieldCheckIcon,
}

export default async function DeploymentProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'

  // Active profile from env (no secrets)
  const activeType = (process.env.DEPLOYMENT_PROFILE ?? 'managed') as DeploymentProfile['type']

  // Sovereign egress controls
  const egressEnforced = process.env.SOVEREIGN_EGRESS_ENFORCED === 'true'
  const egressHosts = (process.env.SOVEREIGN_EGRESS_ALLOWLIST ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Deployment Profile</h1>
        <p className="text-gray-500 mt-1">
          Sovereign deployment configuration and responsibility matrix
        </p>
      </div>

      <div className="space-y-8">
        {PROFILES.map((profile) => {
          const isActive = profile.type === activeType
          return (
            <div
              key={profile.type}
              className={`border rounded-xl overflow-hidden ${
                isActive ? `${profile.color} ring-2 ring-offset-2` : 'border-gray-200 bg-white'
              }`}
            >
              {/* Header */}
              <div className="px-6 py-5 flex items-center gap-4">
                <div className={`inline-flex p-3 rounded-lg ${profile.color}`}>
                  <profile.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
                    {isActive && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{profile.description}</p>
                </div>
              </div>

              {/* Details */}
              <div className="border-t border-gray-100 px-6 py-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase">Data Residency</p>
                  </div>
                  <p className="text-sm text-gray-700">{profile.dataResidency}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowPathIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase">Update Model</p>
                  </div>
                  <p className="text-sm text-gray-700">{profile.updateModel}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase">Patch Cadence</p>
                  </div>
                  <p className="text-sm text-gray-700">{profile.patchCadence}</p>
                </div>
              </div>

              {/* Responsibility matrix */}
              <div className="border-t border-gray-100">
                <div className="px-6 py-3 flex items-center gap-2">
                  <UserGroupIcon className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Responsibility Matrix
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-6 py-2 font-medium">Area</th>
                      <th className="px-6 py-2 font-medium">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.responsibilities.map((r) => (
                      <tr key={r.area} className="text-gray-700">
                        <td className="px-6 py-2">{r.area}</td>
                        <td className="px-6 py-2">{r.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Sovereign Egress Controls ────────────────────────────────────── */}
      {activeType === 'sovereign' && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-6 py-5 flex items-center gap-4">
            <div className="inline-flex p-3 rounded-lg bg-red-50 text-red-600">
              <NoSymbolIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Egress Allowlist Enforcement</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Sovereign mode blocks all outbound connections not in the approved allowlist.
              </p>
            </div>
            <div className="ml-auto">
              {egressEnforced ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                  <CheckBadgeIcon className="h-4 w-4" /> ENFORCED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                  NOT ENFORCED
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 px-6 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Approved Egress Hosts ({egressHosts.length})
            </p>
            {egressHosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {egressHosts.map((host) => (
                  <div
                    key={host}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <CheckBadgeIcon className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-mono text-gray-700">{host}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No egress hosts configured.</p>
            )}
          </div>

          <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 text-xs text-gray-400">
            Enforcement is managed via <span className="font-mono">SOVEREIGN_EGRESS_ALLOWLIST</span>{' '}
            and <span className="font-mono">SOVEREIGN_EGRESS_ENFORCED</span> environment variables.
          </div>
        </div>
      )}
    </div>
  )
}
