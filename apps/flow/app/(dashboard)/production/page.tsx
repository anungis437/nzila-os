import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  WrenchScrewdriverIcon,
  CheckBadgeIcon,
  TruckIcon,
  ClockIcon,
  EyeIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import { getOrdersAction } from '@/app/actions/orders'

export const metadata = { title: 'Production — Flow' }

const stageConfig: Record<string, { icon: typeof ClockIcon; accent: string; bg: string }> = {
  pending_proof:  { icon: ClockIcon,              accent: 'text-amber-600',   bg: 'bg-amber-50' },
  proof_sent:     { icon: EyeIcon,                accent: 'text-blue-600',    bg: 'bg-blue-50' },
  proof_approved: { icon: CheckBadgeIcon,         accent: 'text-violet-600',  bg: 'bg-violet-50' },
  in_production:  { icon: WrenchScrewdriverIcon,  accent: 'text-electric',    bg: 'bg-electric/5' },
  quality_check:  { icon: CubeIcon,               accent: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ready_to_ship:  { icon: TruckIcon,              accent: 'text-emerald-600', bg: 'bg-emerald-50' },
}

const productionStatuses = [
  'pending_proof', 'proof_sent', 'proof_approved',
  'in_production', 'quality_check', 'ready_to_ship',
  // uppercase variants from quotes
  'PENDING_PROOF', 'PROOF_SENT', 'PROOF_APPROVED',
  'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP',
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default async function ProductionPage() {
  const locale = await getLocale()
  const base = `/${locale}/dashboard`

  type OrderRow = Awaited<ReturnType<typeof getOrdersAction>>['rows'][number]

  let allOrders: OrderRow[] = []
  try {
    const result = await getOrdersAction({ limit: 500 })
    allOrders = result.rows ?? []
  } catch {
    // DB not available
  }

  // Filter to production-relevant orders
  const productionOrders = allOrders.filter((o) =>
    productionStatuses.includes(o.status),
  )

  // Count by stage (normalize to lowercase)
  const stageCounts = new Map<string, { count: number; value: number }>()
  for (const stage of Object.keys(stageConfig)) {
    stageCounts.set(stage, { count: 0, value: 0 })
  }
  for (const order of productionOrders) {
    const normalized = (order.status ?? '').toLowerCase()
    const entry = stageCounts.get(normalized)
    if (entry) {
      entry.count++
      entry.value += Number(order.total ?? 0)
    }
  }

  const activeJobs = productionOrders.length
  const pendingApproval = (stageCounts.get('pending_proof')?.count ?? 0) + (stageCounts.get('proof_sent')?.count ?? 0)
  const readyToShip = stageCounts.get('ready_to_ship')?.count ?? 0

  const kpis = [
    { label: 'Active Jobs', value: activeJobs, icon: WrenchScrewdriverIcon, accent: 'text-electric' },
    { label: 'Pending Proof Approval', value: pendingApproval, icon: ClockIcon, accent: 'text-amber-600' },
    { label: 'Ready to Ship', value: readyToShip, icon: TruckIcon, accent: 'text-emerald-600' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Production</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track production jobs, proof approvals, and quality checks across all orders.
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-sm transition-shadow"
          >
            <div className="rounded-lg bg-gray-50 p-2.5">
              <k.icon className={`h-5 w-5 ${k.accent}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Production Pipeline ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
          Production Pipeline
        </h2>
        <div className="space-y-3">
          {Object.entries(stageConfig).map(([stage, config]) => {
            const data = stageCounts.get(stage) ?? { count: 0, value: 0 }
            const maxCount = Math.max(...[...stageCounts.values()].map((v) => v.count), 1)
            const widthPct = data.count > 0 ? Math.max(12, (data.count / maxCount) * 100) : 0
            const StageIcon = config.icon
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className={`rounded-lg p-1.5 ${config.bg}`}>
                  <StageIcon className={`h-4 w-4 ${config.accent}`} />
                </div>
                <span className="text-sm text-gray-700 w-28 truncate capitalize">
                  {stage.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                  <div
                    className={`h-full ${config.bg} rounded-full flex items-center px-3 text-xs font-semibold ${config.accent} transition-all`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {data.count > 0 ? data.count : ''}
                  </div>
                </div>
                <span className="text-sm font-mono text-gray-500 w-20 text-right tabular-nums">
                  {fmt(data.value)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Active Production Orders ───────────────────────────────── */}
      {productionOrders.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-navy">Active Production Orders</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Reference</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Stage</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Total</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {productionOrders.slice(0, 20).map((order) => {
                const normalized = (order.status ?? '').toLowerCase()
                const cfg = stageConfig[normalized] ?? stageConfig.in_production
                return (
                  <tr key={order.id} className="hover:bg-electric/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`${base}/orders/${order.id}`} className="font-semibold text-electric hover:text-electric-light transition-colors">
                        {order.ref ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${cfg.bg} ${cfg.accent}`}>
                        {normalized.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-gray-900">
                      {fmt(Number(order.total ?? 0))}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500 text-xs">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-CA') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="rounded-2xl bg-electric/5 p-5 mb-5">
            <WrenchScrewdriverIcon className="h-10 w-10 text-electric" />
          </div>
          <h2 className="text-lg font-semibold text-navy mb-1">No production jobs</h2>
          <p className="text-sm text-gray-500 max-w-md mb-4">
            Production jobs are created when orders pass the payment gate. View and manage them from{' '}
            <Link href={`${base}/orders`} className="text-electric hover:underline">Orders</Link>.
          </p>
        </div>
      )}
    </div>
  )
}
