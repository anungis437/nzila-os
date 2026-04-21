/**
 * Client Account Detail — Nzila Service Operations Layer
 *
 * Per-client view: onboarding pipeline, health score, open tickets,
 * activity log, expansion notes, renewal details.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ONBOARDING_STAGE_LABELS,
  CLIENT_HEALTH_LABELS,
  ONBOARDING_PIPELINE,
  type OnboardingStage,
  type ClientHealth,
  type NzilaProduct,
} from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

const PRODUCT_LABELS: Record<NzilaProduct, string> = {
  union_eyes: 'Union Eyes',
  faircase: 'FairCase',
  flow: 'Flow',
  zonga: 'Zonga',
  agrimo: 'Agrimo',
  platform: 'Platform',
  other: 'Other',
}

const HEALTH_BADGE: Record<ClientHealth, string> = {
  healthy: 'bg-green-100 text-green-700',
  needs_attention: 'bg-yellow-100 text-yellow-800',
  at_risk: 'bg-red-100 text-red-700',
  churned: 'bg-gray-100 text-gray-500',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params

  // TODO: fetch from DB — `db.select().from(opsClients).where(and(eq(opsClients.id, id), eq(opsClients.orgId, orgId)))`
  // Return 404 if not found / wrong org
  if (!id) notFound()

  // Placeholder shape — replace with real DB row
  type ClientRow = {
    id: string
    companyName: string
    contactName: string | null
    contactEmail: string | null
    product: NzilaProduct
    onboardingStage: OnboardingStage
    health: ClientHealth
    healthScore: number
    accountOwnerName: string | null
    goLiveDate: string | null
    renewalDate: string | null
    contractValue: string | null
    notes: string | null
    expansionNotes: string | null
    openTickets: number
    createdAt: string
    // Account 360 fields
    paymentStatus: 'current' | 'overdue' | 'at_risk' | null
    productsSubscribed: string[] | null
    upsellCandidates: string[] | null
    lastMeetingDate: string | null
    sentimentNote: string | null
    riskFlags: string[] | null
    slaAttainment: number | null
    incidentCount: number | null
    referralPotential: 'high' | 'medium' | 'low' | null
    caseStudyCandidate: boolean | null
    expansionMap: string | null
  }

  const client = null as ClientRow | null // null = not found yet (DB not wired)

  if (!client) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-700">Client not found</p>
          <p className="text-xs text-gray-400 mt-1">
            This client account may not exist or is not accessible to your organisation.
          </p>
          <Link href="/itsm/clients" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            ← Back to Client Accounts
          </Link>
        </div>
      </div>
    )
  }

  const currentIdx = ONBOARDING_PIPELINE.indexOf(client.onboardingStage as typeof ONBOARDING_PIPELINE[number])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{client.companyName}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_BADGE[client.health]}`}>
              {CLIENT_HEALTH_LABELS[client.health]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {PRODUCT_LABELS[client.product]} · Account since {client.createdAt.slice(0, 10)}
          </p>
        </div>
        <Link href="/itsm/clients" className="text-sm text-gray-500 hover:text-gray-700">
          ← Clients
        </Link>
      </div>

      {/* Onboarding pipeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Onboarding Pipeline</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {ONBOARDING_PIPELINE.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                i < currentIdx
                  ? 'bg-blue-100 text-blue-600'
                  : i === currentIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {i < currentIdx && <span>✓</span>}
                {ONBOARDING_STAGE_LABELS[stage]}
              </div>
              {i < ONBOARDING_PIPELINE.length - 1 && (
                <span className={`text-sm ${i < currentIdx ? 'text-blue-300' : 'text-gray-200'}`}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Health Score', value: `${client.healthScore}/100` },
          { label: 'Open Tickets', value: client.openTickets > 0 ? String(client.openTickets) : '0' },
          { label: 'Go-Live Date', value: client.goLiveDate ?? '—' },
          { label: 'Renewal Date', value: client.renewalDate ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Contact + ownership */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
          <div className="space-y-1 text-sm text-gray-600">
            <p>{client.contactName ?? '—'}</p>
            {client.contactEmail && (
              <a href={`mailto:${client.contactEmail}`} className="text-blue-600 hover:underline">
                {client.contactEmail}
              </a>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Account Owner</h2>
          <p className="text-sm text-gray-600">{client.accountOwnerName ?? 'Unassigned'}</p>
          {client.contractValue && (
            <p className="text-xs text-gray-400">Contract value: R {client.contractValue}</p>
          )}
        </div>
      </div>

      {/* Notes + expansion */}
      {(client.notes ?? client.expansionNotes) && (
        <div className="grid grid-cols-2 gap-4">
          {client.notes && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Internal Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
          {client.expansionNotes && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Expansion Opportunities</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.expansionNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Open tickets shortcut */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Support Tickets</h2>
          <Link
            href={`/itsm/queue?clientId=${client.id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            View in Support Desk →
          </Link>
        </div>
        <p className="text-xs text-gray-400 italic">Ticket linking available once DB service layer is wired.</p>
      </div>

      {/* ── Account 360: Commercial ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Commercial</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Contract Value</p>
            <p className="text-lg font-bold text-white">
              {client.contractValue ? `R ${client.contractValue}` : '—'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Renewal Date</p>
            <p className="text-lg font-bold text-white">{client.renewalDate ?? '—'}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Payment Status</p>
            <p className={`text-sm font-semibold ${
              client.paymentStatus === 'current' ? 'text-emerald-400' :
              client.paymentStatus === 'overdue' ? 'text-red-400' :
              client.paymentStatus === 'at_risk' ? 'text-amber-400' :
              'text-slate-400'
            }`}>
              {client.paymentStatus ?? 'Unknown'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Products</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(client.productsSubscribed ?? [client.product]).map(p => (
                <span key={p} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
        {client.upsellCandidates && client.upsellCandidates.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Upsell Candidates</p>
            <div className="flex flex-wrap gap-2">
              {client.upsellCandidates.map(c => (
                <span key={c} className="text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                  ↑ {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Account 360: Relationship ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Relationship</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Last Meeting</p>
            <p className="text-sm text-white font-medium">{client.lastMeetingDate ?? 'Not recorded'}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Sentiment</p>
            <p className="text-sm text-slate-300">{client.sentimentNote ?? '—'}</p>
          </div>
        </div>
        {client.riskFlags && client.riskFlags.length > 0 && (
          <div className="bg-red-950/40 border border-red-900 rounded-lg p-3">
            <p className="text-xs text-red-400 font-semibold mb-1.5">Risk Flags</p>
            <ul className="space-y-1">
              {client.riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-200">
                  <span className="text-red-500 mt-0.5">⚑</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Account 360: Operational ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Operational</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Open Tickets</p>
            <p className={`text-xl font-bold ${client.openTickets >= 4 ? 'text-red-400' : client.openTickets > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {client.openTickets}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Onboarding Stage</p>
            <p className="text-sm font-medium text-white">{ONBOARDING_STAGE_LABELS[client.onboardingStage]}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">SLA Attainment</p>
            <p className={`text-xl font-bold ${
              (client.slaAttainment ?? 0) >= 95 ? 'text-emerald-400' :
              (client.slaAttainment ?? 0) >= 80 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {client.slaAttainment != null ? `${client.slaAttainment}%` : '—'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Incidents (month)</p>
            <p className={`text-xl font-bold ${(client.incidentCount ?? 0) >= 3 ? 'text-red-400' : 'text-white'}`}>
              {client.incidentCount ?? 0}
            </p>
          </div>
        </div>
        <Link href={`/itsm/queue?clientId=${client.id}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Full ticket history →
        </Link>
      </div>

      {/* ── Account 360: Strategic ────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Strategic</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Referral Potential</p>
            <p className={`text-sm font-semibold ${
              client.referralPotential === 'high' ? 'text-emerald-400' :
              client.referralPotential === 'medium' ? 'text-amber-400' :
              'text-slate-400'
            }`}>
              {client.referralPotential ?? 'Not assessed'} {client.referralPotential === 'high' ? '★★★' : client.referralPotential === 'medium' ? '★★' : ''}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Case Study Candidate</p>
            <p className={`text-sm font-semibold ${client.caseStudyCandidate ? 'text-emerald-400' : 'text-slate-500'}`}>
              {client.caseStudyCandidate === true ? 'Yes ✓' : client.caseStudyCandidate === false ? 'No' : '—'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 col-span-full lg:col-span-1">
            <p className="text-xs text-slate-500 mb-1">Expansion Map</p>
            <p className="text-sm text-slate-300">{client.expansionMap ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
