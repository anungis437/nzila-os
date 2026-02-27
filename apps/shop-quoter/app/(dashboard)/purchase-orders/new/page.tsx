'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { createPurchaseOrderAction } from '@/app/actions/purchase-orders'
import { getSuppliersAction } from '@/app/actions/suppliers'
import { getProductsAction } from '@/app/actions/products'

interface POLineItem {
  id: string
  productId: string
  productName: string
  sku: string
  quantity: number
  unitCost: number
}

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
  costPrice: string
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSupplier = searchParams.get('supplierId') ?? ''
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState(preselectedSupplier)
  const [lines, setLines] = useState<POLineItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const [supplierResult, productResult] = await Promise.all([
          getSuppliersAction({ status: 'active' }),
          getProductsAction({ status: 'active' }),
        ])
        setSuppliers(supplierResult.rows)
        setProducts(productResult.rows)
      } catch {
        // Silently fail - dropdowns will just be empty
      }
    }
    loadData()
  }, [])

  const addLine = () => {
    setLines([...lines, {
      id: `line-${Date.now()}`,
      productId: '',
      productName: '',
      sku: '',
      quantity: 1,
      unitCost: 0,
    }])
  }

  const updateLine = (id: string, field: keyof POLineItem, value: string | number) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line
      
      if (field === 'productId') {
        const product = products.find(p => p.id === value)
        if (product) {
          return {
            ...line,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitCost: parseFloat(product.costPrice) || 0,
          }
        }
      }
      
      return { ...line, [field]: value }
    }))
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id))
  }

  const subtotal = lines.reduce((acc, line) => acc + (line.quantity * line.unitCost), 0)
  const taxRate = 0.15 // 15% tax
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Please add at least one line item')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const expectedDate = formData.get('expectedDate') as string
    
    try {
      // Create the PO (lines will need to be added after via edit)
      await createPurchaseOrderAction({
        supplierId,
        expectedDeliveryDate: expectedDate ? new Date(expectedDate) : null,
        notes: formData.get('notes') as string || null,
      })
      
      router.push('/purchase-orders')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new PO to order inventory from your suppliers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Supplier & Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              <select
                id="supplierId"
                name="supplierId"
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select supplier</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expectedDate" className="block text-sm font-medium text-gray-700 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                id="expectedDate"
                name="expectedDate"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Any special instructions..."
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              <PlusIcon className="h-4 w-4" />
              Add Item
            </button>
          </div>
          
          {lines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Product</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Unit Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-50">
                    <td className="px-6 py-3">
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(line.id, 'productId', e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select product</option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>{prod.name} ({prod.sku})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      ${line.unitCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      ${(line.quantity * line.unitCost).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Subtotal</td>
                  <td className="px-4 py-3 text-right font-mono">${subtotal.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Tax (15%)</td>
                  <td className="px-4 py-3 text-right font-mono">${taxAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 mb-3">No items added yet.</p>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
              >
                <PlusIcon className="h-4 w-4" />
                Add First Item
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-500">
            {lines.length} item{lines.length !== 1 ? 's' : ''} · Total: <span className="font-semibold">${total.toFixed(2)}</span>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/purchase-orders"
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || lines.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Create PO
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
