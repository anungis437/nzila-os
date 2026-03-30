import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { listCommissions, getCommissionSummary } from '@/lib/actions/commission-actions'

export default async function CommissionsPage() {
  const [summary, { commissions, total }] = await Promise.all([
    getCommissionSummary(),
    listCommissions(),
  ])

  const cards = [
    { label: 'Total Commissions', value: `$${summary.totalEarned.toLocaleString()}`, icon: CurrencyDollarIcon, sub: `${summary.commissionCount} entries` },
    { label: 'Pending Payout', value: `$${summary.pending.toLocaleString()}`, icon: ClockIcon, sub: 'Awaiting approval' },
    { label: 'Paid Out', value: `$${summary.paidOut.toLocaleString()}`, icon: CheckCircleIcon, sub: 'Transferred' },
    { label: 'Platform Multiplier', value: `${summary.currentMultiplier}×`, icon: ArrowTrendingUpIcon, sub: 'Current tier' },
  ]

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Commission Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform-wide commission overview and payout management
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <c.icon className="w-5 h-5 text-slate-400 mb-3" />
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Commission Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Commission Ledger</h2>
          <span className="text-xs text-slate-400">{total} total</span>
        </div>

        {commissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Deal / Account</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Partner</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Base</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Multiplier</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Final</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-900">{c.accountName}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{c.partnerName ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">${Number(c.baseAmount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-right">{Number(c.multiplier).toFixed(2)}×</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900 text-right">${Number(c.finalAmount).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'paid' ? 'bg-green-100 text-green-800' :
                        c.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
              <BanknotesIcon className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">No commissions recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Commissions are created when partner deals are closed and approved.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
