/**
 * Platform Admin — SLA Profile Editor
 *
 * Real DB-backed list of org-specific SLA profiles plus the platform default
 * baseline (always shown for comparison). Org admins can create / delete
 * profiles; deletion is refused when a queue still references the profile.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DEFAULT_SLA_TARGETS } from '@nzila/itsm-core'
import type { SlaTarget, SlaTargets } from '@nzila/itsm-core'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { listSlaProfiles } from '../../../lib/itsm-queries'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../../lib/org-page-fallbacks'
import { canWrite } from '../../../lib/org-scope-guard'
import {
  DeleteSlaProfileButton,
  NewSlaProfileDialog,
} from '../_components/itsm-actions'

export const runtime = 'nodejs'
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

function ProfileTable({ targets }: { targets: SlaTargets }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
        <tr>
          <th className="px-5 py-3 text-left">Priority</th>
          <th className="px-5 py-3 text-left">First Response</th>
          <th className="px-5 py-3 text-left">Resolution Target</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {(Object.entries(targets) as [string, SlaTarget][]).map(([priority, t]) => (
          <tr key={priority}>
            <td className="px-5 py-3 font-medium text-gray-900">
              {PRIORITY_LABELS[priority] ?? priority}
            </td>
            <td className="px-5 py-3 text-gray-600">{minutesToHuman(t.responseMinutes)}</td>
            <td className="px-5 py-3 text-gray-600">{minutesToHuman(t.resolutionMinutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default async function SlaProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>
}) {
  const sp = await searchParams
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel
        candidates={result.candidates}
        returnTo="/itsm-config/sla-profiles"
      />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const profiles = await listSlaProfiles(orgId)
  const writable = canWrite(orgRole)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/itsm-config" className="text-gray-400 hover:text-gray-600 text-sm">
          ← ITSM Config
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SLA Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define response and resolution targets. Assign profiles to queues and MSP contracts.
          </p>
        </div>
        {writable && (
          <NewSlaProfileDialog orgId={orgId} defaults={DEFAULT_SLA_TARGETS} />
        )}
      </div>

      {/* Platform default profile */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Platform Default</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Built-in baseline — applies when no custom profile is assigned
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">
            Active
          </span>
        </div>
        <ProfileTable targets={DEFAULT_SLA_TARGETS} />
      </div>

      {/* Custom profiles */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Custom Profiles</h2>
        {profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-400">
              No custom SLA profiles for this organisation yet.
              {writable && ' Create one to override defaults for specific queues or contracts.'}
            </p>
          </div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {p.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                  {writable && <DeleteSlaProfileButton orgId={orgId} slaId={p.id} />}
                </div>
              </div>
              <ProfileTable targets={p.targets} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
