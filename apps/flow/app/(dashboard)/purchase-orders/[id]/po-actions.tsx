'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  PaperAirplaneIcon,
  CheckCircleIcon,
  TruckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  sendPurchaseOrderAction,
  acknowledgePurchaseOrderAction,
  receiveLineAction,
  cancelPurchaseOrderAction,
} from '@/app/actions/purchase-orders'

interface POLine {
  id: string
  description: string
  quantity: number
  quantityReceived: number
}

interface POActionsProps {
  poId: string
  status: string
  lines: POLine[]
}

export function POActions({ poId, status, lines }: POActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showReceive, setShowReceive] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})

  const canSend = status === 'draft' || status === 'approved'
  const canAcknowledge = status === 'sent'
  const canReceive = ['sent', 'acknowledged', 'partial_received'].includes(status)
  const canCancel = ['draft', 'sent', 'acknowledged'].includes(status)

  async function handleAction(action: () => Promise<unknown>, label: string) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${label}`)
      }
    })
  }

  async function handleReceive() {
    setError(null)
    startTransition(async () => {
      try {
        for (const line of lines) {
          const qty = receiveQtys[line.id]
          if (qty && qty > 0) {
            await receiveLineAction(line.id, qty)
          }
        }
        setShowReceive(false)
        setReceiveQtys({})
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to receive items')
      }
    })
  }

  const receivableLines = lines.filter((l) => l.quantityReceived < l.quantity)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {canSend && (
          <button
            onClick={() => handleAction(() => sendPurchaseOrderAction(poId), 'send')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-electric rounded-lg hover:bg-electric/90 transition shadow-sm disabled:opacity-50"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {isPending ? 'Sending...' : 'Send to Supplier'}
          </button>
        )}

        {canAcknowledge && (
          <button
            onClick={() => handleAction(() => acknowledgePurchaseOrderAction(poId), 'acknowledge')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition shadow-sm disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Acknowledge
          </button>
        )}

        {canReceive && (
          <button
            onClick={() => setShowReceive(!showReceive)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-electric rounded-lg hover:bg-electric/90 transition shadow-sm disabled:opacity-50"
          >
            <TruckIcon className="h-4 w-4" />
            Receive Stock
          </button>
        )}

        {canCancel && (
          <button
            onClick={() => {
              if (confirm('Cancel this purchase order?')) {
                handleAction(() => cancelPurchaseOrderAction(poId), 'cancel')
              }
            }}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            <XCircleIcon className="h-4 w-4" />
            Cancel PO
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      {/* Inline receive form */}
      {showReceive && receivableLines.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3 space-y-3">
          <h4 className="text-sm font-semibold text-blue-900">Receive Items</h4>
          <div className="space-y-2">
            {receivableLines.map((line) => {
              const remaining = line.quantity - line.quantityReceived
              return (
                <div key={line.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-blue-900">{line.description}</span>
                  <span className="text-blue-600 text-xs">
                    {line.quantityReceived}/{line.quantity} received
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={remaining}
                    value={receiveQtys[line.id] ?? 0}
                    onChange={(e) =>
                      setReceiveQtys({
                        ...receiveQtys,
                        [line.id]: Math.min(parseInt(e.target.value) || 0, remaining),
                      })
                    }
                    className="w-20 border border-blue-300 rounded px-2 py-1 text-center text-sm"
                  />
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleReceive}
              disabled={isPending || Object.values(receiveQtys).every((q) => !q)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isPending ? 'Receiving...' : 'Confirm Receipt'}
            </button>
            <button
              onClick={() => { setShowReceive(false); setReceiveQtys({}) }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showReceive && receivableLines.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
          <p className="text-sm text-green-700 font-medium">All items have been fully received.</p>
        </div>
      )}
    </div>
  )
}
