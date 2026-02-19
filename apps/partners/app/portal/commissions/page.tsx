import {
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'

const summaryCards = [
  { label: 'Total Earned', value: '$0.00', icon: CurrencyDollarIcon, sub: 'Lifetime commissions' },
  { label: 'Pending', value: '$0.00', icon: ClockIcon, sub: 'Awaiting deal closure' },
  { label: 'Paid Out', value: '$0.00', icon: CheckCircleIcon, sub: 'Transferred to account' },
  { label: 'Tier Multiplier', value: '1.0×', icon: ArrowTrendingUpIcon, sub: 'Registered tier base rate' },
]

const tierMultipliers = [
  { tier: 'Registered', multiplier: '1.0×', active: true },
  { tier: 'Select / Certified', multiplier: '1.15×', active: false },
  { tier: 'Premier / Advanced', multiplier: '1.35×', active: false },
  { tier: 'Elite / Strategic', multiplier: '1.50×', active: false },
]

export default function CommissionsPage() {
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
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition">
          <ArrowDownTrayIcon className="w-4 h-4" />
          Export Statement
        </button>
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
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
              <BanknotesIcon className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">No commissions yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Commissions are calculated when your registered deals close successfully.
            </p>
          </div>
        </div>

        {/* Tier multiplier table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Tier Multipliers</h2>
          </div>
          <div className="p-4 space-y-2">
            {tierMultipliers.map((t) => (
              <div
                key={t.tier}
                className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                  t.active ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${t.active ? 'text-blue-900' : 'text-slate-600'}`}>
                    {t.tier}
                  </p>
                  {t.active && (
                    <p className="text-[11px] text-blue-600 mt-0.5">Current tier</p>
                  )}
                </div>
                <span className={`text-sm font-bold ${t.active ? 'text-blue-700' : 'text-slate-400'}`}>
                  {t.multiplier}
                </span>
              </div>
            ))}
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
