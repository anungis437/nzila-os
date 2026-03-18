'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { createOrderAction, createOrderLineAction, getOrderByRefAction } from '@/app/actions/orders'
import { getCustomersAction } from '@/app/actions/customers'
import { getProductsAction } from '@/app/actions/products'

interface LineItem {
  key: string
  productId: string
  description: string
  sku: string
  quantity: number
  unitPrice: number
}

interface Customer { id: string; name: string; email: string | null }

function generateOrderRef() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`
}
interface Product { id: string; name: string; sku: string | null; basePrice: string | null }

export default function NewOrderPage() {
  const router = useRouter()
  const locale = useLocale()
  const base = `/${locale}/dashboard`

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function load() {
      const [custResult, prodResult] = await Promise.all([
        getCustomersAction(),
        getProductsAction({ limit: 500, status: 'active' }),
      ])
      setCustomers(custResult.rows as Customer[])
      setProducts(prodResult.rows as Product[])
    }
    load()
  }, [])

  const addLine = () => {
    setLines([...lines, {
      key: `line-${Date.now()}`,
      productId: '',
      description: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
    }])
  }

  const updateLine = (key: string, field: keyof LineItem, value: string | number) => {
    setLines(lines.map((l) => (l.key !== key ? l : { ...l, [field]: value })))
  }

  const selectProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setLines(lines.map((l) =>
      l.key !== key
        ? l
        : {
            ...l,
            productId,
            description: product.name,
            sku: product.sku ?? '',
            unitPrice: parseFloat(product.basePrice ?? '0'),
          },
    ))
  }

  const removeLine = (key: string) => {
    setLines(lines.filter((l) => l.key !== key))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const taxRate = 0.15
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!customerId) { setError('Please select a customer'); return }
    if (lines.length === 0) { setError('Please add at least one line item'); return }

    setIsSubmitting(true)
    setError(null)

    const ref = generateOrderRef()

    try {
      await createOrderAction({
        customerId,
        ref,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxAmount.toFixed(2),
        total: total.toFixed(2),
        notes: notes || null,
      })

      // Look up the created order by ref to get its ID
      const created = await getOrderByRefAction(ref)

      if (created) {
        // Add line items
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]
          await createOrderLineAction(created.id, {
            description: l.description,
            sku: l.sku || null,
            quantity: l.quantity,
            unitPrice: l.unitPrice.toFixed(2),
            lineTotal: (l.quantity * l.unitPrice).toFixed(2),
            sortOrder: i,
          })
        }
        router.push(`${base}/orders/${created.id}`)
      } else {
        router.push(`${base}/orders`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`${base}/orders`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-electric transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Orders
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Create Order</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new sales order for a customer.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Customer & Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-navy mb-4">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
                required
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-navy">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-electric/5 text-electric text-sm font-medium rounded-lg hover:bg-electric/10 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Add Item
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No line items yet. Add products to this order.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Product</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Total</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-gray-50">
                    <td className="px-6 py-3">
                      <select
                        value={l.productId}
                        onChange={(e) => selectProduct(l.key, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-electric/30"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-electric/30"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      ${(l.quantity * l.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {lines.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax (15%)</span>
                <span className="font-mono">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-navy pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="font-mono text-lg">${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={`${base}/orders`}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-electric rounded-lg hover:bg-electric-light transition shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  )
}
