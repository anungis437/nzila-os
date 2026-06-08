import Link from 'next/link'
import {
  CpuChipIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  SparklesIcon,
  BeakerIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { Card, CardBody, KpiTile, Badge, EmptyState } from '@/components/ui'
import { LegacyBridge } from '../../_components/legacy-bridge'
import { bridgeFor } from '../../_lib/legacy-map'
import { loadAiManagement } from '../../_lib/ai-management'

function statusTone(status: string): 'green' | 'amber' | 'red' | 'gray' {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'approved' || s === 'succeeded' || s === 'completed') return 'green'
  if (s === 'running' || s === 'pending' || s === 'training') return 'amber'
  if (s === 'failed' || s === 'error') return 'red'
  return 'gray'
}

interface SurfaceCard {
  key: string
  name: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  href: string
  value: string
  sublabel: string
}

export async function AiManagementPanel() {
  const ai = await loadAiManagement()
  const bridge = bridgeFor('operations', 'ai')

  const budgetSummary =
    ai.budgetCount > 0
      ? `$${ai.budgetSpentUsd.toFixed(2)} / $${ai.budgetCapUsd.toFixed(2)}`
      : 'No budgets configured'

  const surfaceCards: SurfaceCard[] = [
    {
      key: 'ml-fleet',
      name: 'Live ML fleet',
      description: 'Active models, serving runs, and anomaly posture from the Console ML subsystem.',
      icon: CpuChipIcon,
      href: '/console/ml/overview',
      value: ai.available ? String(ai.activeModels.length) : '—',
      sublabel: ai.available
        ? `${ai.recentInference.length} recent inference runs`
        : 'ML platform unavailable',
    },
    {
      key: 'registry',
      name: 'Model registry',
      description: 'Registered model families and approved deployment configurations.',
      icon: BeakerIcon,
      href: '/console/ai/models',
      value: `${ai.modelRegistryCount}`,
      sublabel: `${ai.deploymentCount} deployments`,
    },
    {
      key: 'routes',
      name: 'Deployment routes',
      description: 'Real app/profile/feature routing into the live AI deployments.',
      icon: SparklesIcon,
      href: '/console/ai/models',
      value: `${ai.deploymentRouteCount}`,
      sublabel: 'Routing is DB-backed',
    },
    {
      key: 'usage',
      name: 'Usage analytics',
      description: 'Request volume, cost, latency, and refusal posture across the entity.',
      icon: CurrencyDollarIcon,
      href: '/console/ai/usage',
      value: `${ai.requestCount}`,
      sublabel: `$${ai.requestCostUsd.toFixed(4)} spend · ${ai.requestRefusedCount} refusals`,
    },
    {
      key: 'actions',
      name: 'Actions & approvals',
      description: 'Deterministic action proposals, approvals, and execution readiness.',
      icon: ShieldCheckIcon,
      href: '/console/ai/actions',
      value: `${ai.actionCount}`,
      sublabel: `${ai.actionPendingCount} pending or running`,
    },
    {
      key: 'knowledge',
      name: 'Knowledge sources',
      description: 'Ingestion-backed sources feeding retrieval and grounded responses.',
      icon: BoltIcon,
      href: '/console/ai/knowledge',
      value: `${ai.knowledgeSourceCount}`,
      sublabel: budgetSummary,
    },
  ]

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        The control surface for the platform&rsquo;s AI/ML fleet — models, runs, routing, usage, and
        the live governance surfaces layered on top. Everything shown here is backed by real data
        or a real page in Console.
      </p>

      {/* Live fleet KPIs */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiTile
          label="Active models"
          value={ai.available ? ai.activeModels.length : '—'}
          sublabel={ai.available ? 'In the serving fleet' : 'ML platform unreachable'}
          icon={<CpuChipIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Requests"
          value={ai.available ? ai.requestCount : '—'}
          sublabel="AI request ledger"
          icon={<BoltIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Actions"
          value={ai.available ? ai.actionCount : '—'}
          sublabel="Proposed / approved / executed"
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Budget posture"
          value={budgetSummary}
          sublabel={ai.budgetCount > 0 ? `${ai.budgetCount} budgets tracked` : 'No budget rows yet'}
          icon={<CurrencyDollarIcon className="h-5 w-5" />}
        />
      </div>

      {/* Real capability grid */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900">Live AI surfaces</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {surfaceCards.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.key} className="h-full">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-300" />
                      <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                    </div>
                    <Badge tone="green">Live</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{c.description}</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold text-gray-900">{c.value}</p>
                      <p className="text-xs text-gray-400">{c.sublabel}</p>
                    </div>
                    <Link
                      href={c.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Open <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Models table */}
      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-gray-900">Active models</h3>
          <p className="mt-1.5 text-sm text-gray-500">
            The current serving fleet with version and approval state.
          </p>
          <div className="mt-5">
            {ai.available && ai.activeModels.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      {['Model key', 'Algorithm', 'Version', 'Status', 'Approved'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ai.activeModels.map((m) => (
                      <tr key={m.id} className="bg-white">
                        <td className="px-5 py-3 font-mono text-xs text-gray-700">{m.modelKey}</td>
                        <td className="px-5 py-3 text-gray-600">{m.algorithm}</td>
                        <td className="px-5 py-3 tabular-nums text-gray-600">v{m.version}</td>
                        <td className="px-5 py-3">
                          <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {m.approvedAt ? new Date(m.approvedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<CpuChipIcon className="h-6 w-6" />}
                title={ai.available ? 'No active models' : 'ML platform unreachable'}
                description={
                  ai.available
                    ? 'Train and approve a model to populate the serving fleet.'
                    : 'The ML platform API is not configured or reachable from this environment. Live fleet state will appear here once connected.'
                }
              />
            )}
          </div>
        </CardBody>
      </Card>

      {/* Recent inference runs */}
      {ai.available && ai.recentInference.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-gray-900">Recent inference runs</h3>
            <div className="mt-5 space-y-2">
              {ai.recentInference.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-700">{r.modelKey}</span>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(r.startedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/console/ml/runs"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all runs <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </CardBody>
        </Card>
      )}

      {/* Deep admin surfaces */}
      {bridge && <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} />}
    </div>
  )
}
