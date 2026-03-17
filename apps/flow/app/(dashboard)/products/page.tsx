import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import { getProductsAction } from '@/app/actions/products'
import { getInventoryAction, getInventorySummaryAction } from '@/app/actions/inventory'

/** Product status badge colours. */
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  discontinued: 'bg-red-100 text-red-700',
  draft: 'bg-amber-100 text-amber-700',
}

/** Stock level indicators. */
function getStockLevelStyle(quantity: number, reorderPoint: number): { color: string; label: string } {
  if (quantity <= 0) return { color: 'text-red-600', label: 'Out of Stock' }
  if (quantity <= reorderPoint) return { color: 'text-amber-600', label: 'Low Stock' }
  return { color: 'text-green-600', label: 'In Stock' }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function ProductsListPage() {
  // Fetch products and inventory from database
  const [productsResult, inventoryResult, summary] = await Promise.all([
    getProductsAction(),
    getInventoryAction(),
    getInventorySummaryAction(),
  ])

  const products = productsResult.rows
  const inventoryList = inventoryResult.rows

  // Build inventory lookup by productId
  const inventoryByProduct = new Map(inventoryList.map((inv) => [inv.productId, inv]))

  // Summary stats
  const activeCount = products.filter((p) => p.status === 'active').length
  const lowStockCount = summary?.lowStockCount ?? 0
  const outOfStockCount = summary?.outOfStockCount ?? 0
  const totalValue = summary?.totalStockValue ?? 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products & Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your product catalog and track inventory levels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync Inventory
          </button>
          <Link
            href="/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Low Stock</p>
            <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
          </div>
          {lowStockCount > 0 && (
            <ExclamationTriangleIcon className="h-8 w-8 text-amber-400" />
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
          {outOfStockCount > 0 && (
            <CubeIcon className="h-8 w-8 text-red-400" />
          )}
        </div>
      </div>

      {/* Inventory Value Banner */}
      <div className="bg-linear-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-purple-700 font-medium">Total Inventory Value (at cost)</p>
          <p className="text-3xl font-bold text-purple-900">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <Link
          href="/products/movements"
          className="text-sm text-purple-600 font-medium hover:underline"
        >
          View Stock Movements →
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Categories</option>
          <option value="chocolates">Chocolates</option>
          <option value="coffee">Coffee</option>
          <option value="packaging">Packaging</option>
          <option value="specialty">Specialty</option>
        </select>
        <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <FunnelIcon className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Product
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Category
              </th>
              <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Stock Level
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Unit Cost
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Unit Price
              </th>
              <th className="text-right px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs">
                Last Restock
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const inv = inventoryByProduct.get(product.id)
              const quantity = inv?.currentStock ?? 0
              const reorderPoint = inv?.reorderPoint ?? 10
              const stockStyle = getStockLevelStyle(quantity, reorderPoint)
              return (
                <tr
                  key={product.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <Link href={`/products/${product.id}`} className="block">
                      <span className="font-semibold text-purple-600 hover:underline block">
                        {product.name}
                      </span>
                      <span className="text-xs text-gray-500">{product.sku}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{product.category}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusColors[product.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className={`font-mono font-semibold ${stockStyle.color}`}>
                      {quantity}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">/ {reorderPoint} min</span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-600 font-mono">
                    ${parseFloat(product.costPrice).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-900 font-mono font-semibold">
                    ${parseFloat(product.basePrice).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">
                    {inv?.updatedAt?.toLocaleDateString() ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <CubeIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 mb-3">No products found.</p>
            <Link href="/products/new" className="text-purple-600 font-semibold hover:underline">
              Add your first product →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
