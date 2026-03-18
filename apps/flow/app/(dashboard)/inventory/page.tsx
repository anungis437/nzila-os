import {
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { getInventoryAction, getInventorySummaryAction, getStockMovementsAction, getLowStockAction } from '@/app/actions/inventory'
import { getProductsAction } from '@/app/actions/products'
import { AdjustStockButton, RecordMovementButton } from './inventory-actions'

export const metadata = { title: 'Inventory — Flow' }

const stockStatusBadge: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  in_stock:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'In Stock' },
  low_stock:    { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Low Stock' },
  out_of_stock: { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-400',     label: 'Out of Stock' },
  overstock:    { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-400',    label: 'Overstock' },
}

const movementBadge: Record<string, { bg: string; text: string }> = {
  receipt:    { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  allocation: { bg: 'bg-violet-50', text: 'text-violet-700' },
  adjustment: { bg: 'bg-amber-50',  text: 'text-amber-700' },
  return:     { bg: 'bg-blue-50',   text: 'text-blue-700' },
  sale:       { bg: 'bg-electric/5', text: 'text-electric' },
}

export default async function InventoryPage() {
  let inventory: Awaited<ReturnType<typeof getInventoryAction>> = { rows: [], total: 0, limit: 100, offset: 0 }
  let summary: Awaited<ReturnType<typeof getInventorySummaryAction>> | null = null
  let movements: Awaited<ReturnType<typeof getStockMovementsAction>> = { rows: [], total: 0, limit: 20, offset: 0 }
  let lowStock: Awaited<ReturnType<typeof getLowStockAction>> = []
  let products: Awaited<ReturnType<typeof getProductsAction>> = { rows: [], total: 0, limit: 500, offset: 0 }

  try {
    ;[inventory, summary, movements, lowStock, products] = await Promise.all([
      getInventoryAction({ limit: 100 }),
      getInventorySummaryAction(),
      getStockMovementsAction({ limit: 20 }),
      getLowStockAction(),
      getProductsAction({ limit: 500 }),
    ])
  } catch {
    // DB not available — render with empty defaults
  }

  const productMap = new Map(products.rows.map((p) => [p.id, p.name ?? p.sku ?? 'Unknown']))

  // Compute KPIs from inventory rows if summary not available
  const totalProducts = summary?.totalProducts ?? inventory.rows.length
  const inStock = inventory.rows.filter((i) => i.stockStatus === 'in_stock').length
  const lowStockCount = summary?.lowStockCount ?? inventory.rows.filter((i) => i.stockStatus === 'low_stock').length
  const outOfStock = summary?.outOfStockCount ?? inventory.rows.filter((i) => i.stockStatus === 'out_of_stock').length

  const kpis = [
    { label: 'Total Products', value: totalProducts, icon: CubeIcon, accent: 'text-electric' },
    { label: 'In Stock', value: inStock, icon: CheckCircleIcon, accent: 'text-emerald-600' },
    { label: 'Low Stock', value: lowStockCount, icon: ExclamationTriangleIcon, accent: 'text-amber-600' },
    { label: 'Out of Stock', value: outOfStock, icon: XCircleIcon, accent: 'text-red-500' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Stock levels, movements, reservations, and low-stock alerts.
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* ── Low-Stock Alerts ───────────────────────────────────────── */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Low Stock Alerts</h2>
            <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              {lowStock.length} items
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 8).map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-800"
              >
                {productMap.get(item.productId) ?? 'Product'}
                <span className="text-amber-500">({item.currentStock ?? 0} left)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Inventory Table ────────────────────────────────────────── */}
      {inventory.rows.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">In Stock</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Allocated</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Available</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Reorder Pt.</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Location</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inventory.rows.map((item) => {
                const status = stockStatusBadge[item.stockStatus] ?? stockStatusBadge.in_stock
                const available = (item.currentStock ?? 0) - (item.allocatedStock ?? 0)
                return (
                  <tr key={item.id} className="group hover:bg-electric/[0.02] transition-colors">
                    <td className="px-5 py-4 font-medium text-navy">
                      {productMap.get(item.productId) ?? item.productId?.slice(0, 8)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-gray-900">
                      {item.currentStock ?? 0}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-gray-500">
                      {item.allocatedStock ?? 0}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-gray-900">
                      {available}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-gray-500">
                      {item.reorderPoint ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{item.location ?? '—'}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <AdjustStockButton inventoryId={item.id} productName={productMap.get(item.productId) ?? 'Product'} currentStock={item.currentStock ?? 0} />
                        <RecordMovementButton inventoryId={item.id} productId={item.productId ?? ''} productName={productMap.get(item.productId) ?? 'Product'} />
                      </div>
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
            <ArchiveBoxIcon className="h-10 w-10 text-electric" />
          </div>
          <h2 className="text-lg font-semibold text-navy mb-1">No inventory yet</h2>
          <p className="text-sm text-gray-500 max-w-md">
            Inventory records will appear here as products are added and stock levels tracked.
          </p>
        </div>
      )}

      {/* ── Recent Stock Movements ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4 text-electric" />
          <h2 className="text-sm font-semibold text-navy">Recent Stock Movements</h2>
          <span className="ml-auto text-xs text-gray-400">{movements.rows.length} latest</span>
        </div>
        {movements.rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements.rows.map((m) => {
                const badge = movementBadge[m.movementType] ?? { bg: 'bg-gray-50', text: 'text-gray-700' }
                return (
                  <tr key={m.id} className="hover:bg-electric/[0.02] transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-navy text-xs">
                      {productMap.get(m.productId) ?? m.productId?.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
                        {(m.movementType ?? 'unknown').charAt(0).toUpperCase() + (m.movementType ?? 'unknown').slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{m.reason ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            No movements recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
