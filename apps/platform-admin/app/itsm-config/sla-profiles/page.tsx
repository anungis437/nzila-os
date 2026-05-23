/**
 * Platform Admin — SLA Profile Editor
 *
 * Create and manage SLA profiles. Each profile defines response and
 * resolution targets per priority tier.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_SLA_TARGETS } from '@nzila/itsm-core'
import type { SlaTarget } from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SLA Profiles | ITSM Config',
}

const PRIORITY_LABELS: Record<string, string> = {
  p1_critical: 'P1 Critical',
  p2_high: 'P2 High',
  p3_medium: 'P3 Medium',
  p4_low: 'P4 Low',
}

function minutesToHuman(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${minutes / 60}h`
  return `${minutes / 1440}d`
}

export default async function SlaProfilesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: load org-level SLA profiles from DB. Until that is wired warn so the
  // "only platform defaults" rendering is visible in server logs and is not
  // mistaken for an org without custom SLA overrides.
  console.warn(
    '[platform-admin] itsm-config/sla-profiles: org-level SLA profile DB query is not wired — showing platform defaults only',
  )
  // For now, show the platform default
  const defaultProfile = DEFAULT_SLA_TARGETS

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
          ← ITSM Config
        </Link>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
        Demo mode: org-level SLA profile overrides are not yet loaded from the
        database. Only the built-in platform defaults are shown below —
        custom profiles attached to this org will not appear until the DB
        query is wired.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define response and resolution targets. Assign profiles to queues and MSP contracts.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Profile
        </button>
      </div>

      {/* Platform default profile */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Platform Default</h2>
            <p className="text-xs text-gray-400 mt-0.5">Built-in baseline — applies when no custom profile is assigned</p>
          </div>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">Active</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">Priority</th>
              <th className="px-5 py-3 text-left">First Response</th>
              <th className="px-5 py-3 text-left">Resolution Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(Object.entries(defaultProfile) as [string, SlaTarget][]).map(([priority, targets]) => (
              <tr key={priority}>
                <td className="px-5 py-3 font-medium text-gray-900">
                  {PRIORITY_LABELS[priority] ?? priority}
                </td>
                <td className="px-5 py-3 text-gray-600">
                  {minutesToHuman(targets.responseMinutes)}
                </td>
                <td className="px-5 py-3 text-gray-600">
                  {minutesToHuman(targets.resolutionMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom profiles (empty state) */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-400">
          No custom SLA profiles yet. Create a profile to override defaults for specific queues or contracts.
        </p>
      </div>
    </div>
  )
}
