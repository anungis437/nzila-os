import Link from 'next/link'
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  RocketLaunchIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { Card, CardBody, KpiTile, Badge, EmptyState, Button } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { bridgeFor } from '../_lib/legacy-map'
import { resolveSubTab } from '../_lib/nav'
import {
  loadVentures,
  summarizePortfolio,
  buildVentureDomains,
  directiveTone,
  formatCurrency,
  type Directive,
} from '../_lib/ventures'
import { loadDealsLive, dealsForStages, PIPELINE_COLUMNS } from '../_lib/sales'
import { loadFunding, grantStatusTone, type FundingView, type GrantRow } from '../_lib/funding'
import { createGrant, updateGrant, deleteGrant } from '../_lib/funding-actions'
import { requireWorkspaceUser } from '../_lib/workspace-auth'

export const dynamic = 'force-dynamic'

const DIRECTIVE_ORDER: Directive[] = ['SELL NOW', 'BUILD NEXT', 'MAINTAIN', 'HOLD', 'CUT']

const GRANT_STATUSES = [
  'prospecting',
  'drafting',
  'submitted',
  'awarded',
  'rejected',
  'reporting',
  'closed',
] as const

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'

export default async function PortfolioWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireWorkspaceUser()

  const { tab } = await searchParams
  const activeTab = resolveSubTab('portfolio', tab)

  const ventures = loadVentures()
  const portfolio = summarizePortfolio(ventures)
  const funding = activeTab === 'funding' ? await loadFunding() : null

  return (
    <WorkspaceShell workspace="portfolio" activeTab={activeTab}>
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <KpiTile label="Active ventures" value={portfolio.activeVentures} icon={<BuildingOffice2Icon className="h-5 w-5" />} />
            <KpiTile label="ARR" value={formatCurrency(portfolio.totalArr)} icon={<BanknotesIcon className="h-5 w-5" />} />
            <KpiTile label="Active pilots" value={portfolio.livePilots} icon={<RocketLaunchIcon className="h-5 w-5" />} />
            <KpiTile label="Pipeline" value={formatCurrency(portfolio.totalPipeline)} icon={<ArrowTrendingUpIcon className="h-5 w-5" />} />
          </div>
          <Card>
            <CardBody>
              <h3 className="text-base font-semibold text-gray-900">Directive split</h3>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
                {DIRECTIVE_ORDER.map((d) => (
                  <div key={d} className="rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-semibold tabular-nums text-gray-900">{portfolio.directiveCounts[d]}</p>
                    <div className="mt-1 flex justify-center">
                      <Badge tone={directiveTone(d)}>{d}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {(() => {
            const bridge = bridgeFor('portfolio', 'overview')
            return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
          })()}
        </div>
      )}

      {activeTab === 'ventures' && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {buildVentureDomains(ventures).map((domain) => (
            <Link key={domain.key} href="/workspace/ventures">
              <Card interactive className="h-full">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold text-gray-900">{domain.name}</span>
                    {domain.directive ? (
                      <Badge tone={directiveTone(domain.directive)}>{domain.directive}</Badge>
                    ) : (
                      <Badge tone="gray">Planned</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{domain.tagline}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                    <span>{formatCurrency(domain.arr)} ARR</span>
                    <span>{domain.pilots} pilots</span>
                    <span>{domain.customers} customers</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'pipeline' && (
        <PipelinePanel />
      )}

      {activeTab === 'funding' && funding && <FundingPanel funding={funding} />}

      {activeTab === 'funding' && (() => {
        const bridge = bridgeFor('portfolio', 'funding')
        return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
      })()}
    </WorkspaceShell>
  )
}

function GrantFields({ grant }: { grant?: GrantRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>Program name *</label>
        <input name="programName" type="text" required defaultValue={grant?.programName} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Grantor</label>
        <input name="grantor" type="text" defaultValue={grant?.grantor ?? undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={grant?.status ?? 'prospecting'} className={inputClass}>
          {GRANT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Requested</label>
        <input name="amountRequested" type="number" min="0" step="0.01" defaultValue={grant ? grant.amountRequested || undefined : undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Awarded</label>
        <input name="amountAwarded" type="number" min="0" step="0.01" defaultValue={grant ? grant.amountAwarded || undefined : undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Drawn down</label>
        <input name="amountDrawnDown" type="number" min="0" step="0.01" defaultValue={grant ? grant.amountDrawnDown || undefined : undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Currency</label>
        <input name="currency" type="text" defaultValue={grant?.currency ?? 'CAD'} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Application deadline</label>
        <input name="applicationDeadline" type="date" defaultValue={grant?.applicationDeadline ?? undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Decision date</label>
        <input name="decisionDate" type="date" defaultValue={grant?.decisionDate ?? undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Report due</label>
        <input name="reportDueDate" type="date" defaultValue={grant?.reportDueDate ?? undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Owner</label>
        <input name="owner" type="text" defaultValue={grant?.owner ?? undefined} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Product key</label>
        <input name="productKey" type="text" defaultValue={grant?.productKey ?? undefined} placeholder="union-eyes, flow…" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={grant?.notes ?? undefined} className={inputClass} />
      </div>
    </div>
  )
}

function NewGrantButton() {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
        <PlusIcon className="h-4 w-4" /> New grant
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-120 max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 text-left shadow-lg">
        <form action={createGrant} className="space-y-4">
          <GrantFields />
          <div className="flex justify-end">
            <Button type="submit" size="sm">Create grant</Button>
          </div>
        </form>
      </div>
    </details>
  )
}

function FundingPanel({ funding }: { funding: FundingView }) {
  const hasGrants = funding.source === 'db' && funding.grants.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {hasGrants
            ? `${funding.totals.count} grant ${funding.totals.count === 1 ? 'application' : 'applications'}`
            : 'Standing funding sources'}
        </p>
        <NewGrantButton />
      </div>

      {hasGrants ? (
        <>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <KpiTile label="Active grants" value={funding.totals.count} icon={<BanknotesIcon className="h-5 w-5" />} />
            <KpiTile label="Requested" value={formatCurrency(funding.totals.requested)} icon={<BanknotesIcon className="h-5 w-5" />} />
            <KpiTile label="Awarded" value={formatCurrency(funding.totals.awarded)} icon={<BanknotesIcon className="h-5 w-5" />} />
            <KpiTile label="Drawn down" value={formatCurrency(funding.totals.drawnDown)} icon={<BanknotesIcon className="h-5 w-5" />} />
          </div>
          <Card>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-3 pr-6 font-medium">Program</th>
                      <th className="py-3 pr-6 font-medium">Grantor</th>
                      <th className="py-3 pr-6 font-medium">Status</th>
                      <th className="py-3 pr-6 text-right font-medium">Requested</th>
                      <th className="py-3 pr-6 text-right font-medium">Awarded</th>
                      <th className="py-3 pr-6 font-medium">Deadline</th>
                      <th className="py-3 pr-6 font-medium">Owner</th>
                      <th className="py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funding.grants.map((g) => (
                      <tr key={g.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-6 font-medium text-gray-900">{g.programName}</td>
                        <td className="py-3 pr-6 text-gray-600">{g.grantor ?? '—'}</td>
                        <td className="py-3 pr-6">
                          <Badge tone={grantStatusTone(g.status)}>{g.status}</Badge>
                        </td>
                        <td className="py-3 pr-6 text-right tabular-nums text-gray-900">{formatCurrency(g.amountRequested)}</td>
                        <td className="py-3 pr-6 text-right tabular-nums text-gray-900">{formatCurrency(g.amountAwarded)}</td>
                        <td className="py-3 pr-6 text-gray-500">{g.applicationDeadline ?? '—'}</td>
                        <td className="py-3 pr-6 text-gray-500">{g.owner ?? '—'}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <details className="group relative">
                              <summary className="inline-flex cursor-pointer list-none items-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit grant">
                                <PencilSquareIcon className="h-4 w-4" />
                              </summary>
                              <div className="absolute right-0 z-10 mt-2 w-120 max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 text-left shadow-lg">
                                <form action={updateGrant} className="space-y-4">
                                  <input type="hidden" name="grantId" value={g.id} />
                                  <GrantFields grant={g} />
                                  <div className="flex justify-end">
                                    <Button type="submit" size="sm">Save changes</Button>
                                  </div>
                                </form>
                              </div>
                            </details>
                            <form action={deleteGrant}>
                              <input type="hidden" name="grantId" value={g.id} />
                              <button
                                type="submit"
                                title="Delete grant"
                                className="inline-flex items-center rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {funding.sources.map((f) => (
                <div key={f.name} className="flex items-start justify-between rounded-xl border border-gray-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{f.note}</p>
                  </div>
                  <Badge tone="gray">{f.kind}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <EmptyState
                icon={<BanknotesIcon className="h-6 w-6" />}
                title="No grants recorded yet"
                description="These are the standing funding sources. Use “New grant” to record an application — program, grantor, status, amounts, and deadlines appear here automatically."
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

async function PipelinePanel() {
  const deals = await loadDealsLive()
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {PIPELINE_COLUMNS.map((col) => {
        const colDeals = dealsForStages(deals, col.stages)
        const value = colDeals.reduce((s, d) => s + d.estimatedValue, 0)
        return (
          <div key={col.key} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{col.label}</span>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                {colDeals.length}
              </span>
            </div>
            <p className="mb-3 text-xs text-gray-400">{formatCurrency(value)}</p>
            <div className="space-y-2">
              {colDeals.length === 0 ? (
                <p className="text-xs text-gray-300">—</p>
              ) : (
                colDeals.map((d) => (
                  <div key={d.id} className="rounded-lg border border-gray-100 bg-white p-2">
                    <Link
                      href={`/workspace/sales/${d.id}`}
                      className="truncate text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {d.accountName}
                    </Link>
                    <p className="mt-0.5 flex items-center justify-between text-[10px] text-gray-400">
                      <span className="uppercase">{d.product}</span>
                      <span>{formatCurrency(d.estimatedValue)}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
