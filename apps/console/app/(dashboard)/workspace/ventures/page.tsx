import {
  RocketLaunchIcon,
  BanknotesIcon,
  UsersIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Card, CardBody, Badge, StatusPill } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import {
  loadVentures,
  buildVentureDomains,
  directiveTone,
  formatCurrency,
  type VentureDomainView,
} from '../_lib/ventures'
import { loadDealsLive, summarizeSales } from '../_lib/sales'
import { requireWorkspaceUser } from '../_lib/workspace-auth'

export const dynamic = 'force-dynamic'

/** Honest, structural blocker copy derived from venture state. */
function blockerFor(domain: VentureDomainView): string {
  if (domain.status === 'planned') return 'Domain not yet started — no product surface built.'
  const directive = domain.directive
  if (directive === 'SELL NOW') return 'Convert active pilot(s) into signed contracts.'
  if (directive === 'BUILD NEXT') return 'Finish core build before scaling go-to-market.'
  if (directive === 'MAINTAIN') return 'Stable — keep pipeline warm, no active blocker.'
  if (directive === 'CUT') return 'Frozen — under review for wind-down.'
  return 'Awaiting prioritization.'
}

export default async function VenturesWorkspace() {
  await requireWorkspaceUser()

  const domains = buildVentureDomains(loadVentures())
  const deals = await loadDealsLive()
  const sales = summarizeSales(deals)
  const topPipelineDeals = deals
    .filter((d) => d.estimatedValue > 0)
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 5)

  return (
    <WorkspaceShell workspace="ventures">
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Revenue pipeline</h3>
              <p className="mt-1 text-sm text-gray-500">Live from the Sales workspace command surface.</p>
            </div>
            <Badge tone={topPipelineDeals.length > 0 ? 'green' : 'gray'}>
              {topPipelineDeals.length > 0 ? `${topPipelineDeals.length} active` : 'No active deals'}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Pipeline value</p>
              <p className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(sales.pipelineValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Open opportunities</p>
              <p className="text-sm font-semibold tabular-nums text-gray-900">{sales.openOpportunities}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Active pilots</p>
              <p className="text-sm font-semibold tabular-nums text-gray-900">{sales.activePilots}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Converted value</p>
              <p className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(sales.convertedValue)}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            {topPipelineDeals.length === 0 ? (
              <p className="text-sm text-gray-500">No pipeline deals available yet.</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-700">
                {topPipelineDeals.map((deal) => (
                  <li key={deal.id} className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
                    <Link
                      href={`/workspace/sales/${deal.id}`}
                      className="truncate font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {deal.accountName}
                    </Link>
                    <span className="shrink-0 tabular-nums text-gray-700">{formatCurrency(deal.estimatedValue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {domains.map((domain) => (
          <Card key={domain.key}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <RocketLaunchIcon className="h-5 w-5 shrink-0 text-gray-300" />
                    <h3 className="truncate text-base font-semibold text-gray-900">{domain.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{domain.tagline}</p>
                </div>
                {domain.status === 'active' ? (
                  <StatusPill status="running" label="Active" />
                ) : (
                  <Badge tone="gray">Planned</Badge>
                )}
              </div>

              {/* Roadmap directive + maturity of underlying products */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {domain.directive && <Badge tone={directiveTone(domain.directive)}>{domain.directive}</Badge>}
                {domain.products.map((p) => (
                  <Badge key={p.id} tone="gray">
                    {p.name} · {p.maturity}
                  </Badge>
                ))}
              </div>

              {/* Revenue / customers */}
              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-gray-100 pt-5">
                <div>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <BanknotesIcon className="h-3.5 w-3.5" /> ARR
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(domain.arr)}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <RocketLaunchIcon className="h-3.5 w-3.5" /> Pilots
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-gray-900">{domain.pilots}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <UsersIcon className="h-3.5 w-3.5" /> Customers
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-gray-900">{domain.customers}</p>
                </div>
              </div>

              {/* Blockers */}
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50/60 p-4">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800">{blockerFor(domain)}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  )
}
