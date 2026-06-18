import Link from 'next/link'
import {
  BuildingOffice2Icon,
  BanknotesIcon,
  RocketLaunchIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ChartBarSquareIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { Card, CardBody, KpiTile, Badge } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { bridgeFor } from '../_lib/legacy-map'
import {
  loadVentures,
  summarizePortfolio,
  directiveTone,
  formatCurrency,
  type Directive,
  type Maturity,
} from '../_lib/ventures'
import { loadDealsLive, summarizeSales } from '../_lib/sales'
import { WORKSPACES } from '../_lib/nav'
import { requireWorkspaceUser } from '../_lib/workspace-auth'

export const dynamic = 'force-dynamic'

const DIRECTIVE_ORDER: Directive[] = ['SELL NOW', 'BUILD NEXT', 'MAINTAIN', 'HOLD', 'CUT']
const MATURITY_ORDER: Maturity[] = ['Live', 'Pilot', 'Building', 'Incubating', 'Frozen']

export default async function OverviewWorkspace() {
  await requireWorkspaceUser()

  const ventures = loadVentures()
  const portfolio = summarizePortfolio(ventures)
  const sales = summarizeSales(await loadDealsLive())

  const quickLinks = WORKSPACES.filter((w) => w.key !== 'overview' && w.key !== 'settings')

  return (
    <WorkspaceShell workspace="overview">
      {/* KPI strip — portfolio health at a glance */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <KpiTile
          label="Active ventures"
          value={portfolio.activeVentures}
          sublabel={`${portfolio.totalVentures} total in catalog`}
          icon={<BuildingOffice2Icon className="h-5 w-5" />}
        />
        <KpiTile
          label="ARR"
          value={formatCurrency(portfolio.totalArr)}
          sublabel="Across portfolio"
          icon={<BanknotesIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Active pilots"
          value={portfolio.livePilots}
          sublabel={`${sales.activePilots} tracked in Deal Engine`}
          icon={<RocketLaunchIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Open opportunities"
          value={sales.openOpportunities}
          sublabel={`${formatCurrency(sales.pipelineValue)} pipeline`}
          icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Customers"
          value={portfolio.totalCustomers}
          sublabel="Converted logos"
          icon={<UsersIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Pipeline value"
          value={formatCurrency(portfolio.totalPipeline)}
          sublabel="Catalog-attributed"
          icon={<ChartBarSquareIcon className="h-5 w-5" />}
        />
      </div>

      {/* Directive split + maturity distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-gray-900">Directive split</h3>
            <p className="mt-1.5 text-sm text-gray-500">Where the portfolio is pointed right now.</p>
            <div className="mt-5 space-y-3">
              {DIRECTIVE_ORDER.map((d) => (
                <div key={d} className="flex items-center justify-between">
                  <Badge tone={directiveTone(d)}>{d}</Badge>
                  <span className="text-sm font-semibold tabular-nums text-gray-700">
                    {portfolio.directiveCounts[d]}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-gray-900">Product maturity</h3>
            <p className="mt-1.5 text-sm text-gray-500">How far each venture has been built.</p>
            <div className="mt-5 space-y-3">
              {MATURITY_ORDER.map((m) => (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{m}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-700">
                    {portfolio.maturityCounts[m]}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick links into each workspace */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900">Jump into a workspace</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {quickLinks.map((w) => (
            <Link key={w.key} href={w.href}>
              <Card interactive className="h-full">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{w.label}</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-300" />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{w.question}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {(() => {
        const bridge = bridgeFor('overview', '')
        return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
      })()}
    </WorkspaceShell>
  )
}
