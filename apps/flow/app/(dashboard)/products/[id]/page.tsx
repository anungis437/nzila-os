import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeftIcon,
  PencilIcon,
  ArrowPathIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'
import { getProductAction } from '@/app/actions/products'
import { getInventoryAction, getStockMovementsAction } from '@/app/actions/inventory'

/** Stock level indicators. */
function getStockLevelStyle(quantity: number, reorderPoint: number): { color: string; bg: string; label: string } {
  if (quantity <= 0) return { color: 'text-red-700', bg: 'bg-red-100', label: 'Out of Stock' }
  if (quantity <= reorderPoint) return { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Low Stock' }
  return { color: 'text-green-700', bg: 'bg-green-100', label: 'In Stock' }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await getProductAction(params.id)
  if (!product) {
    notFound()
  }

  // Fetch inventory and stock movements
  const [inventoryResult, movementsResult] = await Promise.all([
    getInventoryAction({ productId: params.id }),
    getStockMovementsAction({ productId: params.id, limit: 10 }),
  ])

  const inventory = inventoryResult.rows[0]
  const movements = movementsResult.rows

  // Calculate stock values
  const currentStock = inventory?.currentStock ?? 0
  const allocatedStock = inventory?.allocatedStock ?? 0
  const availableStock = inventory?.availableStock ?? (currentStock - allocatedStock)
  const reorderPoint = inventory?.reorderPoint ?? 10

  const stockStyle = getStockLevelStyle(currentStock, reorderPoint)

  // Calculate margin
  const costPrice = parseFloat(product.costPrice)
  const basePrice = parseFloat(product.basePrice)
  const margin = costPrice > 0 ? ((basePrice - costPrice) / basePrice) * 100 : 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Products
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${stockStyle.bg} ${stockStyle.color}`}>
              {stockStyle.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            SKU: <span className="font-mono">{product.sku}</span>
            {product.zohoItemId && (
              <> · Zoho: <span className="font-mono">{product.zohoItemId}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            Sync
          </button>
          <Link
            href={`/products/${params.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm"
          >
            <PencilIcon className="h-4 w-4" />
            Edit Product
          </Link>
        </div>
      </div>

      {/* Stock Alert */}
      {currentStock <= reorderPoint && (
        <div className={`rounded-xl border p-4 mb-6 flex items-center gap-4 ${currentStock === 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <ExclamationTriangleIcon className={`h-6 w-6 ${currentStock === 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <div className="flex-1">
            <p className={`font-semibold ${currentStock === 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {currentStock === 0 ? 'Out of Stock' : 'Low Stock Warning'}
            </p>
            <p className="text-sm text-gray-600">
              {currentStock === 0 
                ? 'This product needs to be restocked immediately.'
                : `Current quantity (${currentStock}) is below reorder point (${reorderPoint}).`}
            </p>
          </div>
          <Link
            href={`/purchase-orders/new?productId=${product.id}`}
            className="px-4 py-2 bg-white text-purple-600 text-sm font-semibold rounded-lg border border-purple-200 hover:bg-purple-50 transition"
          >
            Create PO
          </Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-600">{product.description}</p>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm font-medium text-gray-900">{product.category}</p>
              </div>
              {product.weightGrams && (
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="text-sm font-medium text-gray-900">{product.weightGrams}g</p>
                </div>
              )}
              {product.dimensions && (
                <div>
                  <p className="text-xs text-gray-500">Dimensions</p>
                  <p className="text-sm font-medium text-gray-900">{product.dimensions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Unit Cost</p>
                <p className="text-2xl font-bold text-gray-600">${costPrice.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 mb-1">Unit Price</p>
                <p className="text-2xl font-bold text-purple-700">${basePrice.toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 mb-1">Margin</p>
                <p className="text-2xl font-bold text-green-700">{margin.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Stock Movements */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Stock Movements</h2>
              <Link
                href={`/products/${params.id}/movements`}
                className="text-sm text-purple-600 font-medium hover:underline"
              >
                View All →
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Type</th>
                  <th className="text-left py-2 font-medium text-gray-500">Reason</th>
                  <th className="text-left py-2 font-medium text-gray-500">Reference</th>
                  <th className="text-right py-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right py-2 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mv) => {
                  const isIn = mv.quantity > 0
                  const typeLabel = mv.movementType === 'receipt' ? 'Stock In' 
                    : mv.movementType === 'allocation' ? 'Allocated'
                    : mv.movementType === 'return' ? 'Returned'
                    : 'Adjustment'
                  const typeColor = isIn ? 'text-green-600' : mv.movementType === 'adjustment' ? 'text-amber-600' : 'text-red-600'
                  
                  return (
                    <tr key={mv.id} className="border-b border-gray-50">
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${typeColor}`}>
                          {isIn ? <PlusIcon className="h-3 w-3" /> : mv.movementType === 'adjustment' ? <ArrowPathIcon className="h-3 w-3" /> : <MinusIcon className="h-3 w-3" />}
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">{mv.reason ?? '—'}</td>
                      <td className="py-3">
                        {mv.referenceId ? (
                          <span className="text-purple-600 font-mono text-xs">{mv.referenceId.slice(0, 8)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={`py-3 text-right font-mono font-semibold ${mv.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mv.quantity > 0 ? '+' : ''}{mv.quantity}
                      </td>
                      <td className="py-3 text-right text-gray-500">{new Date(mv.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Inventory</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Total Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{currentStock}</p>
                </div>
                <CubeIcon className="h-8 w-8 text-gray-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600">Available</p>
                  <p className="text-xl font-bold text-green-700">{availableStock}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600">Reserved</p>
                  <p className="text-xl font-bold text-amber-700">{allocatedStock}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Reorder Point</span>
                  <span className="font-medium text-gray-900">{reorderPoint}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">Last Restocked</span>
                  <span className="font-medium text-gray-900">{inventory?.lastRestockedAt ? new Date(inventory.lastRestockedAt).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier */}
          {product.supplierId && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Supplier</h3>
              <Link
                href={`/suppliers/${product.supplierId}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-purple-50 transition"
              >
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CubeIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">View Supplier</p>
                  <p className="text-xs text-gray-500">View supplier details →</p>
                </div>
              </Link>
            </div>
          )}

          {/* Value */}
          <div className="bg-linear-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
            <h3 className="text-sm font-semibold opacity-80 uppercase tracking-wide mb-2">Stock Value</h3>
            <p className="text-3xl font-bold">
              ${(currentStock * costPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm opacity-70 mt-1">at cost</p>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {product.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{new Date(product.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="text-gray-900">{new Date(product.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
