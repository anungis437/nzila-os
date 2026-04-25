/**
 * Incidents — Nzila Service Operations Layer
 *
 * Production incidents, outages, and security events across all Nzila products.
 * Simplified view: severity, owner, timeline, comms, RCA.
 * Not ITIL theater — just what's needed to run lean production ops.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { type Priority } from '@nzila/itsm-core'
import { platformDb } from '@nzila/db/platform'
import { itsmTickets } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { and, desc, eq, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Incidents | Service Operations' }

// ── Severity display ──────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<Priority, { label: string; badge: string; dot: string }> = {
  p1_critical: {
    label: 'P1 — Critical',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    dot: 'bg-red-500',
  },
  p2_high: {
    label: 'P2 — High',
    badge: 'bg-orange-100 text-orange-700 border border-orange-200',
    dot: 'bg-orange-400',
  },
  p3_medium: {
    label: 'P3 — Medium',
    badge: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    dot: 'bg-yellow-400',
  },
  p4_low: {
    label: 'P4 — Low',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    dot: 'bg-gray-300',
  },
}

const PRODUCT_LABELS: Record<string, string> = {
  union_eyes: 'Union Eyes',
  faircase: 'FairCase',
  flow: 'Flow',
  zonga: 'Zonga',
  agrimo: 'Agrimo',
  platform: 'Platform',
}

type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved'

const STATUS_BADGE: Record<IncidentStatus, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-orange-100 text-orange-700',
  mitigated: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IncidentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  let incidents: Array<{
    id: string
    ticketNumber: string
    title: string
    severity: Priority
    status: IncidentStatus
    product: string
    ownerName: string | null
    openedAt: string
    resolvedAt: string | null
    hasRca: boolean
  }> = []

  if (orgId) {
    const rows = await platformDb
      .select({
        id: itsmTickets.id,
        ticketNumber: itsmTickets.ticketNumber,
        title: itsmTickets.title,
        priority: itsmTickets.priority,
        status: itsmTickets.status,
        assignedToId: itsmTickets.assignedToId,
        createdAt: itsmTickets.createdAt,
        resolvedAt: itsmTickets.resolvedAt,
        closedAt: itsmTickets.closedAt,
        metadata: itsmTickets.metadata,
      })
      .from(itsmTickets)
      .where(and(eq(itsmTickets.orgId, orgId), eq(itsmTickets.type, 'incident')))
      .orderBy(desc(itsmTickets.createdAt))
      .limit(200)
      .catch(() => [])

    incidents = rows.map((row) => {
      const meta = (row.metadata && typeof row.metadata === 'object') ? (row.metadata as Record<string, unknown>) : {}
      const ticketStatus = row.status
      const incidentStatus: IncidentStatus =
        ticketStatus === 'resolved' || ticketStatus === 'closed'
          ? 'resolved'
          : ticketStatus === 'in_progress' || ticketStatus === 'assigned' || ticketStatus === 'triage'
            ? 'investigating'
            : ticketStatus === 'waiting_user' || ticketStatus === 'waiting_vendor'
              ? 'mitigated'
              : 'open'

      return {
        id: row.id,
        ticketNumber: row.ticketNumber,
        title: row.title,
        severity: row.priority as Priority,
        status: incidentStatus,
        product: typeof meta.product === 'string' ? meta.product : 'platform',
        ownerName: row.assignedToId,
        openedAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? row.closedAt?.toISOString() ?? null,
        hasRca: Boolean(meta.rcaCompleted),
      }
    })
  }

  const active = incidents.filter((i) => i.status !== 'resolved')
  const p1Open = active.filter((i) => i.severity === 'p1_critical').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-1">
            Production issues across all Nzila products. Severity · Owner · Timeline · RCA.
          </p>
        </div>
        <Link
          href="/itsm/tickets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          + Declare Incident
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'P1 Active',
            value: p1Open > 0 ? String(p1Open) : '0',
            bg: p1Open > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
            text: p1Open > 0 ? 'text-red-800' : 'text-gray-900',
          },
          { label: 'Active Incidents', value: String(active.length), bg: 'bg-white border-gray-200', text: 'text-gray-900' },
          { label: 'Resolved (30d)', value: String(incidents.filter((i) => i.status === 'resolved').length), bg: 'bg-white border-gray-200', text: 'text-gray-900' },
          { label: 'RCA Pending', value: String(incidents.filter((i) => i.status === 'resolved' && !i.hasRca).length), bg: 'bg-white border-gray-200', text: 'text-gray-900' },
        ].map(({ label, value, bg, text }) => (
          <div key={label} className={`rounded-lg border ${bg} p-4`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Incident list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-medium text-gray-700">No active incidents</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Incidents are tickets of type <strong>incident</strong> raised via the Support Desk.
              They appear here automatically.
            </p>
            <Link
              href="/itsm/tickets/new"
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Declare an incident →
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Incident</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Opened</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">RCA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{inc.ticketNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{inc.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[inc.severity].badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_BADGE[inc.severity].dot}`} />
                      {SEVERITY_BADGE[inc.severity].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{PRODUCT_LABELS[inc.product] ?? inc.product}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[inc.status]}`}>
                      {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inc.ownerName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{inc.openedAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    {inc.status === 'resolved' ? (
                      inc.hasRca ? (
                        <span className="text-xs text-green-600">✓ Done</span>
                      ) : (
                        <span className="text-xs text-orange-500">Pending</span>
                      )
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/itsm/tickets/${inc.id}`} className="text-xs text-blue-600 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Incident runbook shortcut */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-800">Incident runbook</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Standard steps: declare → severity → owner → comms → mitigate → RCA
          </p>
        </div>
        <Link href="/itsm/kb" className="text-xs text-blue-700 font-medium hover:underline">
          Open KB →
        </Link>
      </div>
    </div>
  )
}
