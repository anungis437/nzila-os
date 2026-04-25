/**
 * Client Accounts — Nzila Service Operations Layer
 *
 * Single pane of glass for every Nzila client.
 * Shows onboarding stage, product, health, account owner, and renewal.
 * Linked to the support desk — tickets can be associated with a client account.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { platformDb } from '@nzila/db/platform'
import { opsClients } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { desc, eq } from 'drizzle-orm'
import {
  ONBOARDING_STAGE_LABELS,
  CLIENT_HEALTH_LABELS,
  ONBOARDING_PIPELINE,
  type OnboardingStage,
  type ClientHealth,
  type NzilaProduct,
} from '@nzila/itsm-core'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Client Accounts | Service Operations' }

// ── Display helpers ───────────────────────────────────────────────────────────

const PRODUCT_BADGE: Record<NzilaProduct, string> = {
  union_eyes: 'bg-violet-100 text-violet-700',
  faircase: 'bg-blue-100 text-blue-700',
  flow: 'bg-cyan-100 text-cyan-700',
  zonga: 'bg-emerald-100 text-emerald-700',
  agrimo: 'bg-lime-100 text-lime-700',
  platform: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-500',
}

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

// ── Onboarding pipeline indicator ────────────────────────────────────────────

function PipelineBar({ stage }: { stage: OnboardingStage }) {
  const currentIdx = ONBOARDING_PIPELINE.indexOf(stage as typeof ONBOARDING_PIPELINE[number])
  return (
    <div className="flex items-center gap-0.5">
      {ONBOARDING_PIPELINE.map((s, i) => (
        <div
          key={s}
          title={ONBOARDING_STAGE_LABELS[s]}
          className={`h-1.5 w-4 rounded-full ${
            i <= currentIdx ? 'bg-blue-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientAccountsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  let clients: Array<{
    id: string
    companyName: string
    product: NzilaProduct
    onboardingStage: OnboardingStage
    health: ClientHealth
    accountOwnerName: string | null
    goLiveDate: string | null
    renewalDate: string | null
    openTickets: number
  }> = []

  if (orgId) {
    const rows = await platformDb
      .select({
        id: opsClients.id,
        companyName: opsClients.companyName,
        product: opsClients.product,
        onboardingStage: opsClients.onboardingStage,
        health: opsClients.health,
        accountOwnerId: opsClients.accountOwnerId,
        goLiveDate: opsClients.goLiveDate,
        renewalDate: opsClients.renewalDate,
        openTickets: opsClients.openTickets,
      })
      .from(opsClients)
      .where(eq(opsClients.orgId, orgId))
      .orderBy(desc(opsClients.updatedAt))
      .limit(500)
      .catch(() => [])

    clients = rows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      product: (row.product || 'other') as NzilaProduct,
      onboardingStage: row.onboardingStage as OnboardingStage,
      health: row.health as ClientHealth,
      accountOwnerName: row.accountOwnerId,
      goLiveDate: row.goLiveDate,
      renewalDate: row.renewalDate,
      openTickets: row.openTickets ?? 0,
    }))
  }

  const byHealth = {
    healthy: clients.filter((c) => c.health === 'healthy').length,
    needs_attention: clients.filter((c) => c.health === 'needs_attention').length,
    at_risk: clients.filter((c) => c.health === 'at_risk').length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Onboarding pipeline, health, and support history for every Nzila client.
          </p>
        </div>
        <Link
          href="/itsm/clients/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Onboard Client
        </Link>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Healthy</p>
          <p className="text-3xl font-bold text-green-800 mt-1">{byHealth.healthy}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Needs Attention</p>
          <p className="text-3xl font-bold text-yellow-800 mt-1">{byHealth.needs_attention}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">At Risk</p>
          <p className="text-3xl font-bold text-red-800 mt-1">{byHealth.at_risk}</p>
        </div>
      </div>

      {/* Client table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-sm font-medium text-gray-700">No clients yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Add your first client account to start tracking onboarding,
              health, and support history.
            </p>
            <Link
              href="/itsm/clients/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Onboard First Client
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Onboarding</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Health</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Open Tickets</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Renewal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{client.companyName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRODUCT_BADGE[client.product]}`}>
                      {PRODUCT_LABELS[client.product]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600">{ONBOARDING_STAGE_LABELS[client.onboardingStage]}</p>
                      <PipelineBar stage={client.onboardingStage} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_BADGE[client.health]}`}>
                      {CLIENT_HEALTH_LABELS[client.health]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{client.accountOwnerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    {client.openTickets > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        {client.openTickets}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{client.renewalDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/itsm/clients/${client.id}`} className="text-xs text-blue-600 hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
