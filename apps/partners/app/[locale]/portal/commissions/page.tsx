import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { getCommissionSummary, listCommissions } from '@/lib/actions/commission-actions'

const tierMultipliers = [
  { tier: 'Registered', multiplier: '1.0×', level: 0 },
  { tier: 'Select / Certified', multiplier: '1.15×', level: 1 },
  { tier: 'Premier / Advanced', multiplier: '1.35×', level: 2 },
  { tier: 'Elite / Strategic', multiplier: '1.50×', level: 3 },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default async function CommissionsPage() {
  const [summary, { commissions }] = await Promise.all([
    getCommissionSummary(),
    listCommissions(),
  ])

  const currentLevel = summary.currentMultiplier >= 1.5 ? 3
    : summary.currentMultiplier >= 1.35 ? 2
    : summary.currentMultiplier >= 1.15 ? 1
    : 0

  const summaryCards = [
    { label: 'Total Earned', value: fmt(summary.totalEarned), icon: CurrencyDollarIcon, sub: 'Lifetime commissions' },
    { label: 'Pending', value: fmt(summary.pending), icon: ClockIcon, sub: 'Awaiting deal closure' },
    { label: 'Paid Out', value: fmt(summary.paidOut), icon: CheckCircleIcon, sub: 'Transferred to account' },
    { label: 'Tier Multiplier', value: `${summary.currentMultiplier}×`, icon: ArrowTrendingUpIcon, sub: `Level ${currentLevel} rate` },
  ]

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track your revenue share, payouts, and tier-based multipliers.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <c.icon className="w-5 h-5 text-slate-400 mb-3" />
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Commission ledger */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Commission Ledger</h2>
          </div>

          {commissions.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                  <th className="px-6 py-3">Deal</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{c.accountName}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(c.baseAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{fmt(c.finalAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : c.status === 'approved'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
                <BanknotesIcon className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No commissions yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Commissions are calculated when your registered deals close successfully.
              </p>
            </div>
          )}
        </div>

        {/* Tier multiplier table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Tier Multipliers</h2>
          </div>
          <div className="p-4 space-y-2">
            {tierMultipliers.map((t) => {
              const active = t.level === currentLevel
              return (
                <div
                  key={t.tier}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    active ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${active ? 'text-blue-900' : 'text-slate-600'}`}>
                      {t.tier}
                    </p>
                    {active && (
                      <p className="text-[11px] text-blue-600 mt-0.5">Current tier</p>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${active ? 'text-blue-700' : 'text-slate-400'}`}>
                    {t.multiplier}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Higher tiers unlock better commission rates. Advance by registering deals,
              completing certifications, and maintaining engagement.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
