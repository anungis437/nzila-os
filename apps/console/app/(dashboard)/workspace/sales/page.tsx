import { ArrowTrendingUpIcon, RocketLaunchIcon, BanknotesIcon, PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card, CardBody, KpiTile, Badge, EmptyState, Button } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { bridgeFor } from '../_lib/legacy-map'
import { resolveSubTab } from '../_lib/nav'
import {
  loadSalesView,
  dealsForStages,
  summarizeSales,
  SALES_TAB_STAGES,
  STAGE_METADATA,
  type Deal,
} from '../_lib/sales'
import { createDeal, updateDeal, deleteDeal } from '../_lib/sales-actions'
import { isHubspotConfigured } from '../_lib/hubspot-sync'
import { formatCurrency } from '../_lib/ventures'
import { requireWorkspaceUser, resolveWorkspaceOrgIdForUser } from '../_lib/workspace-auth'
import { DealFields } from './_components/deal-fields'
import { HubspotSyncButton } from './_components/hubspot-sync-button'

export const dynamic = 'force-dynamic'

function riskTone(risk: Deal['conversionRisk']): 'gray' | 'green' | 'amber' | 'red' {
  if (risk === 'low') return 'green'
  if (risk === 'medium') return 'amber'
  if (risk === 'high') return 'red'
  return 'gray'
}

export default async function SalesWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const userId = await requireWorkspaceUser()
  const orgId = await resolveWorkspaceOrgIdForUser(userId)

  const { tab } = await searchParams
  const activeTab = tab ? resolveSubTab('sales', tab) : 'opportunities'

  const { deals: allDeals, editable } = await loadSalesView()
  const sales = summarizeSales(allDeals)
  const hubspotConfigured = await isHubspotConfigured(orgId)
  const stages = SALES_TAB_STAGES[activeTab] ?? []
  const rows = dealsForStages(allDeals, stages)
  const tabValue = rows.reduce((s, d) => s + d.estimatedValue, 0)

  return (
    <WorkspaceShell workspace="sales" activeTab={activeTab}>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <KpiTile label="Open opportunities" value={sales.openOpportunities} icon={<ArrowTrendingUpIcon className="h-5 w-5" />} />
        <KpiTile label="Active pilots" value={sales.activePilots} icon={<RocketLaunchIcon className="h-5 w-5" />} />
        <KpiTile label="Pipeline value" value={formatCurrency(sales.pipelineValue)} icon={<BanknotesIcon className="h-5 w-5" />} />
        <KpiTile label="Converted value" value={formatCurrency(sales.convertedValue)} icon={<BanknotesIcon className="h-5 w-5" />} />
      </div>

      <Card className="mt-8">
        <CardBody>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold capitalize text-gray-900">{activeTab}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {rows.length} deals · {formatCurrency(tabValue)}
              </span>
              <HubspotSyncButton configured={hubspotConfigured} />
              <details className="group relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
                  <PlusIcon className="h-4 w-4" /> New deal
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-md max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                  <form action={createDeal} className="space-y-4">
                    <DealFields />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm">Create deal</Button>
                    </div>
                  </form>
                </div>
              </details>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
              title="No deals in this stage"
              description="Deals flow through the canonical Deal Engine lifecycle. Add one with “New deal” or move existing deals into this stage."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-3 pr-6 font-medium">Account</th>
                    <th className="py-3 pr-6 font-medium">Product</th>
                    <th className="py-3 pr-6 font-medium">Stage</th>
                    <th className="py-3 pr-6 font-medium">Owner</th>
                    <th className="py-3 pr-6 text-right font-medium">Value</th>
                    <th className="py-3 pr-6 text-right font-medium">Days</th>
                    <th className="py-3 pr-6 font-medium">Risk</th>
                    <th className="py-3 pr-6 font-medium">Next action</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const edit = editable[d.id]
                    return (
                      <tr key={d.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-6 font-medium text-gray-900">
                          {edit ? (
                            <Link href={`/workspace/sales/${d.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                              {d.accountName}
                            </Link>
                          ) : (
                            d.accountName
                          )}
                        </td>
                        <td className="py-3 pr-6 uppercase text-gray-500">{d.product}</td>
                        <td className="py-3 pr-6 text-gray-600">{STAGE_METADATA[d.stage].label}</td>
                        <td className="py-3 pr-6 text-gray-500">{d.owner}</td>
                        <td className="py-3 pr-6 text-right tabular-nums text-gray-900">{formatCurrency(d.estimatedValue)}</td>
                        <td className="py-3 pr-6 text-right tabular-nums text-gray-500">{d.daysInStage}</td>
                        <td className="py-3 pr-6">
                          {d.conversionRisk ? <Badge tone={riskTone(d.conversionRisk)}>{d.conversionRisk}</Badge> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-6 text-gray-500">{d.nextAction ?? '—'}</td>
                        <td className="py-3 text-right">
                          {edit ? (
                            <div className="flex items-center justify-end gap-1">
                              <details className="group relative">
                                <summary className="inline-flex cursor-pointer list-none items-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit deal">
                                  <PencilSquareIcon className="h-4 w-4" />
                                </summary>
                                <div className="absolute right-0 z-10 mt-2 w-md max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 text-left shadow-lg">
                                  <form action={updateDeal} className="space-y-4">
                                    <input type="hidden" name="dealId" value={d.id} />
                                    <DealFields deal={edit} />
                                    <div className="flex justify-end">
                                      <Button type="submit" size="sm">Save changes</Button>
                                    </div>
                                  </form>
                                </div>
                              </details>
                              <form action={deleteDeal}>
                                <input type="hidden" name="dealId" value={d.id} />
                                <button
                                  type="submit"
                                  title="Delete deal"
                                  className="inline-flex items-center rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </form>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">seed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {(() => {
        const bridge = bridgeFor('sales', '')
        return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
      })()}
    </WorkspaceShell>
  )
}

