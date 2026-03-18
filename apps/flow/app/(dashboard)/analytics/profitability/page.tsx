'use client'

/**
 * Historical Profitability Report
 *
 * Allows the user to select a past order/mandate and see:
 * - Revenue vs costs breakdown
 * - Margin analysis
 * - Cost sources (POs, product costs, etc.)
 */
import { useState, useEffect, useTransition } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import {
  getOrdersForProfitabilityAction,
  getMandateProfitabilityAction,
} from '@/app/actions/profitability'
import type { MandateProfitability } from '@/lib/profitability'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export default function ProfitabilityReportPage() {
  const locale = useLocale()
  const base = `/${locale}/dashboard`

  const [orders, setOrders] = useState<
    Array<{ id: string; ref: string; total: string; status: string; createdAt: string }>
  >([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [report, setReport] = useState<MandateProfitability | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getOrdersForProfitabilityAction().then((res) => {
      if (res.ok && res.orders) setOrders(res.orders)
    })
  }, [])

  function handleAnalyze() {
    if (!selectedOrderId) return
    setError('')
    setReport(null)

    startTransition(async () => {
      const res = await getMandateProfitabilityAction(selectedOrderId)
      if (res.ok && res.profitability) {
        setReport(res.profitability)
      } else {
        setError(res.error ?? 'Analysis failed')
      }
    })
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Back */}
      <Link
        href={`${base}/analytics`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Retour aux analyses
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-navy">Rentabilité historique</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analysez la rentabilité d&apos;un mandat passé en comparant les revenus aux coûts réels.
        </p>
      </div>

      {/* Order Selector */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 flex items-center gap-2">
          <ChartBarIcon className="h-4 w-4 text-electric" />
          Sélectionner un mandat
        </h2>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-electric/20 focus:border-electric"
          >
            <option value="">— Choisir un mandat —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ref} — {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(o.total))} — {o.status}
              </option>
            ))}
          </select>

          <button
            onClick={handleAnalyze}
            disabled={!selectedOrderId || isPending}
            className="px-6 py-2.5 bg-electric text-white font-semibold text-sm rounded-lg hover:bg-electric/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Analyse en cours...' : 'Analyser la rentabilité'}
          </button>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </section>

      {/* Report */}
      {report && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Revenus</p>
              <p className="text-2xl font-bold text-navy">{fmt(report.revenue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Coûts totaux</p>
              <p className="text-2xl font-bold text-navy">{fmt(report.totalCost)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Profit brut</p>
              <p className={`text-2xl font-bold ${
                report.grossMarginDollars >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {fmt(report.grossMarginDollars)}
              </p>
            </div>
            <div className={`rounded-xl border p-5 text-center ${
              report.status === 'profitable'
                ? 'bg-emerald-50 border-emerald-200'
                : report.status === 'loss'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
            }`}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Marge</p>
              <p className={`text-2xl font-bold ${
                report.status === 'profitable' ? 'text-emerald-600'
                  : report.status === 'loss' ? 'text-red-600'
                  : 'text-amber-600'
              }`}>
                {report.grossMarginPercent.toFixed(1)}%
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {report.status === 'profitable' ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs font-medium capitalize">{report.status === 'profitable' ? 'Rentable' : report.status === 'loss' ? 'Perte' : 'Seuil'}</span>
              </div>
            </div>
          </div>

          {/* Margin Bar Visual */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-electric" />
              Répartition revenus / coûts
            </h3>
            <div className="relative h-10 rounded-lg overflow-hidden bg-gray-100">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-400 rounded-l-lg transition-all"
                style={{ width: `${Math.max(0, Math.min(100, report.grossMarginPercent))}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-red-300 rounded-r-lg transition-all"
                style={{ width: `${Math.max(0, Math.min(100, 100 - report.grossMarginPercent))}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white drop-shadow">
                  {report.grossMarginPercent.toFixed(1)}% marge
                </span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Profit: {fmt(report.grossMarginDollars)}</span>
              <span>Coûts: {fmt(report.totalCost)}</span>
            </div>
          </section>

          {/* Cost Sources Table */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-navy uppercase tracking-wider">
                Sources de coûts
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Source</th>
                  <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Référence</th>
                  <th className="text-left px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-right px-6 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.costs.map((cost, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        cost.source === 'purchase_order'
                          ? 'bg-blue-50 text-blue-700'
                          : cost.source === 'product_costs'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-gray-50 text-gray-700'
                      }`}>
                        {cost.source === 'purchase_order' ? 'Bon de commande'
                          : cost.source === 'product_costs' ? 'Coûts produits (est.)'
                          : cost.source}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">{cost.reference}</td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {new Date(cost.date).toLocaleDateString('fr-CA')}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-navy font-medium">
                      {fmt(cost.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/60">
                  <td colSpan={3} className="px-6 py-3 text-right font-semibold text-navy text-sm">
                    Total des coûts
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-navy text-sm">
                    {fmt(report.totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Order Info */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">
              Détails du mandat
            </h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Référence</dt>
                <dd className="font-medium text-navy">{report.orderRef}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Statut</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    report.status === 'profitable'
                      ? 'bg-emerald-50 text-emerald-700'
                      : report.status === 'loss'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>
                    {report.status === 'profitable' ? 'Rentable' : report.status === 'loss' ? 'Perte' : 'Seuil de rentabilité'}
                  </span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}
