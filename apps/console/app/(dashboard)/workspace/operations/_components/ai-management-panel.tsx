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

interface Capability {
  key: string
  name: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  status: 'live' | 'roadmap'
}

const CAPABILITIES: Capability[] = [
  {
    key: 'models',
    name: 'Models',
    description: 'Registered models, versions, and approval state across the ML fleet.',
    icon: CpuChipIcon,
    status: 'live',
  },
  {
    key: 'runs',
    name: 'Runs & inference',
    description: 'Training and inference run history with anomaly detection on Stripe tracks.',
    icon: BoltIcon,
    status: 'live',
  },
  {
    key: 'agents',
    name: 'Agents',
    description: 'Registry of operating AI agents, their tools, and autonomy scope. Not yet wired.',
    icon: SparklesIcon,
    status: 'roadmap',
  },
  {
    key: 'evals',
    name: 'Evaluations',
    description: 'Quality, regression, and safety evals per model and agent release. Not yet wired.',
    icon: BeakerIcon,
    status: 'roadmap',
  },
  {
    key: 'guardrails',
    name: 'Guardrails',
    description: 'Content, policy, and rate-limit guardrails applied to AI surfaces. Not yet wired.',
    icon: ShieldCheckIcon,
    status: 'roadmap',
  },
  {
    key: 'spend',
    name: 'Spend & quotas',
    description: 'Token spend, model cost allocation, and per-tenant quotas. Not yet wired.',
    icon: CurrencyDollarIcon,
    status: 'roadmap',
  },
]

export async function AiManagementPanel() {
  const ai = await loadAiManagement()
  const bridge = bridgeFor('operations', 'ai')

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        The control surface for the platform&rsquo;s AI/ML fleet — models, runs, and the governed
        capabilities layered on top. Live fleet state is sourced from the ML platform; capabilities
        marked <span className="font-medium text-gray-700">Roadmap</span> are scaffolded and awaiting
        their backend.
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
          label="Inference runs"
          value={ai.available ? ai.recentInference.length : '—'}
          sublabel="Most recent batch"
          icon={<BoltIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Daily anomalies"
          value={ai.available ? ai.dailyAnomalies : '—'}
          sublabel="Stripe daily · 90d"
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
        <KpiTile
          label="Txn anomalies"
          value={ai.available ? ai.txnAnomalies : '—'}
          sublabel="Stripe transactions · 90d"
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
      </div>

      {/* Capability grid */}
      <div>
        <h3 className="mb-4 text-base font-semibold text-gray-900">Governed capabilities</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.key} className="h-full">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-300" />
                      <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                    </div>
                    <Badge tone={c.status === 'live' ? 'green' : 'gray'}>
                      {c.status === 'live' ? 'Live' : 'Roadmap'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{c.description}</p>
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
