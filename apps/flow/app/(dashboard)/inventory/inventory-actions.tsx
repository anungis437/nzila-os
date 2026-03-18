'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { adjustStockAction, recordStockMovementAction } from '@/app/actions/inventory'

// ── Adjust Stock Button + Modal ────────────────────────────────────────────

export function AdjustStockButton({
  inventoryId,
  productName,
  currentStock,
}: {
  inventoryId: string
  productName: string
  currentStock: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [qty, setQty] = useState(String(currentStock))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const newQty = parseInt(qty, 10)
    if (isNaN(newQty) || newQty < 0) {
      setError('Enter a valid quantity (≥ 0)')
      return
    }
    if (!reason.trim()) {
      setError('A reason is required for auditing')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await adjustStockAction(inventoryId, newQty, reason.trim())
        setOpen(false)
        router.refresh()
      } catch {
        setError('Failed to adjust stock')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => { setQty(String(currentStock)); setReason(''); setError(null); setOpen(true) }}
        className="text-xs font-medium text-electric hover:underline"
        title="Adjust stock level"
      >
        <AdjustmentsHorizontalIcon className="h-4 w-4 inline -mt-0.5 mr-0.5" />
        Adjust
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 relative">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold text-navy">Adjust Stock — {productName}</h3>
            <p className="text-sm text-gray-500">Current stock: <span className="font-mono font-semibold">{currentStock}</span></p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
              <input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Cycle count correction"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={pending}
                className="px-4 py-2 text-sm font-semibold text-white bg-electric rounded-lg hover:bg-electric/90 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Record Stock Movement Button + Modal ───────────────────────────────────

export function RecordMovementButton({
  inventoryId,
  productId,
  productName,
}: {
  inventoryId: string
  productId: string
  productName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<'receipt' | 'allocation' | 'adjustment' | 'return' | 'sale'>('receipt')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const quantity = parseInt(qty, 10)
    if (isNaN(quantity) || quantity === 0) {
      setError('Enter a non-zero quantity')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await recordStockMovementAction({
          inventoryId,
          productId,
          movementType: type,
          quantity,
          reason: reason.trim() || null,
        })
        setOpen(false)
        router.refresh()
      } catch {
        setError('Failed to record movement')
      }
    })
  }

  const types = [
    { value: 'receipt', label: 'Receipt (inbound)' },
    { value: 'return', label: 'Return (inbound)' },
    { value: 'sale', label: 'Sale (outbound)' },
    { value: 'allocation', label: 'Allocation' },
    { value: 'adjustment', label: 'Adjustment' },
  ] as const

  return (
    <>
      <button
        onClick={() => { setQty(''); setReason(''); setType('receipt'); setError(null); setOpen(true) }}
        className="text-xs font-medium text-violet-600 hover:underline"
        title="Record stock movement"
      >
        <ArrowsRightLeftIcon className="h-4 w-4 inline -mt-0.5 mr-0.5" />
        Move
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 relative">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold text-navy">Record Movement — {productName}</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric"
              >
                {types.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 50 or -10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. PO-12345 received"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-electric/30 focus:border-electric"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={pending}
                className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-500 disabled:opacity-50"
              >
                {pending ? 'Recording…' : 'Record Movement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
