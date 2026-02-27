'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { createInvoiceAction } from '@/app/actions/invoices'
import { getCustomersAction } from '@/app/actions/customers'
import { getOrdersAction, getOrderLinesAction } from '@/app/actions/orders'

interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

interface Customer {
  id: string
  name: string
  email: string | null
}

interface Order {
  id: string
  ref: string
  total: string
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [lines, setLines] = useState<InvoiceLineItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  // Load customers on mount
  useEffect(() => {
    async function loadCustomers() {
      try {
        const result = await getCustomersAction()
        setCustomers(result.rows)
      } catch {
        // Silently fail
      }
    }
    loadCustomers()
  }, [])

  // Load orders when customer changes
  useEffect(() => {
    async function loadOrders() {
      if (!customerId) {
        setOrders([])
        setOrderId('')
        return
      }
      try {
        const result = await getOrdersAction({ customerId })
        setOrders(result.rows)
      } catch {
        setOrders([])
      }
    }
    loadOrders()
  }, [customerId])

  // Load order lines when order is selected
  useEffect(() => {
    async function loadOrderLines() {
      if (!orderId) return
      try {
        const orderLines = await getOrderLinesAction(orderId)
        setLines(orderLines.map((line: { id: string; description: string; quantity: number; unitPrice: string }) => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: parseFloat(line.unitPrice) || 0,
        })))
      } catch {
        // Keep existing lines
      }
    }
    loadOrderLines()
  }, [orderId])

  const addLine = () => {
    setLines([...lines, {
      id: `line-${Date.now()}`,
      description: '',
      quantity: 1,
      unitPrice: 0,
    }])
  }

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line
      return { ...line, [field]: value }
    }))
  }

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id))
  }

  const subtotal = lines.reduce((acc, line) => acc + (line.quantity * line.unitPrice), 0)
  const taxRate = 0.15
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (lines.length === 0) {
      setError('Please add at least one line item')
      return
    }
    if (!orderId) {
      setError('Please select an order to invoice')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const dueDate = formData.get('dueDate') as string
    
    // Generate a ref number using timestamp
    const timestamp = new Date().getTime()
    const ref = `INV-${timestamp.toString(36).toUpperCase()}`
    
    try {
      // Create the invoice (lines will need to be added after via edit)
      await createInvoiceAction({
        orderId,
        customerId,
        ref,
        subtotal: subtotal.toFixed(2),
        taxTotal: taxAmount.toFixed(2),
        total: total.toFixed(2),
        amountDue: total.toFixed(2),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: formData.get('notes') as string || null,
      })
      
      router.push('/invoices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
      setIsSubmitting(false)
    }
  }

  // Calculate due date (Net 30 by default)
  const today = new Date()
  const dueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new invoice for your customer. This will be synced to Zoho Books.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Customer & Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                id="customerId"
                name="customerId"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select customer</option>
                {customers.map(cust => (
                  <option key={cust.id} value={cust.id}>{cust.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-1">
                Order *
              </label>
              <select
                id="orderId"
                name="orderId"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                disabled={!customerId}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">{customerId ? 'Select order' : 'Select customer first'}</option>
                {orders.map(order => (
                  <option key={order.id} value={order.id}>{order.ref} - ${parseFloat(order.total).toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                id="issueDate"
                name="issueDate"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                required
                defaultValue={dueDate}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Terms
              </label>
              <select
                id="paymentTerms"
                name="paymentTerms"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Net 30">Net 30</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 60">Net 60</option>
                <option value="Due on Receipt">Due on Receipt</option>
              </select>
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
                placeholder="Payment instructions, thank you message, etc."
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
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Description</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500 w-24">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-32">Unit Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Amount</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-50">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                        required
                        placeholder="Item description"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
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
                    <td className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      ${(line.quantity * line.unitPrice).toFixed(2)}
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
              href="/invoices"
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
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
