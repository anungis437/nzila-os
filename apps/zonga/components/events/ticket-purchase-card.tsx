'use client'

/**
 * Zonga — Ticket Purchase Card
 *
 * Displays ticket types for an event with purchase controls.
 */

import { useState } from 'react'
import { Card } from '@nzila/ui'
import { Ticket, Minus, Plus, Loader2, CheckCircle } from 'lucide-react'

interface TicketTypeDisplay {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  quantityAvailable: number
  maxPerOrder: number
  saleStartsAt?: Date
  saleEndsAt?: Date
  isActive: boolean
}

interface TicketPurchaseCardProps {
  eventId: string
  eventTitle: string
  ticketTypes: TicketTypeDisplay[]
  onPurchase: (ticketTypeId: string, quantity: number) => Promise<{
    ok: boolean
    orderId?: string
    error?: string
  }>
}

export function TicketPurchaseCard({
  eventTitle,
  ticketTypes,
  onPurchase,
}: TicketPurchaseCardProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; orderId?: string; error?: string } | null>(null)

  const selected = ticketTypes.find((t) => t.id === selectedType)
  const maxQty = selected ? Math.min(selected.maxPerOrder, selected.quantityAvailable) : 1
  const totalPrice = selected ? selected.price * quantity : 0

  const handlePurchase = async () => {
    if (!selectedType) return
    setIsPurchasing(true)
    setResult(null)
    try {
      const res = await onPurchase(selectedType, quantity)
      setResult(res)
    } finally {
      setIsPurchasing(false)
    }
  }

  if (result?.ok) {
    return (
      <Card>
        <div className="p-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-3 text-lg font-semibold text-foreground">Tickets Confirmed!</h3>
          <p className="mt-1 text-sm text-muted-foreground">{eventTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">Order: {result.orderId}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Check your email for QR codes and event details.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Tickets</h3>
        </div>

        {/* Ticket Type List */}
        <div className="space-y-3">
          {ticketTypes.map((tt) => {
            const isAvailable = tt.isActive && tt.quantityAvailable > 0
            const isSelected = selectedType === tt.id

            return (
              <button
                key={tt.id}
                onClick={() => {
                  setSelectedType(tt.id)
                  setQuantity(1)
                  setResult(null)
                }}
                disabled={!isAvailable}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isAvailable
                    ? 'border-border hover:border-primary/50'
                    : 'border-border opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{tt.name}</p>
                    {tt.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{tt.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {tt.price > 0 ? `${tt.currency} ${tt.price.toFixed(2)}` : 'Free'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isAvailable ? `${tt.quantityAvailable} left` : 'Sold out'}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Quantity + Purchase */}
        {selected && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="rounded-full border border-border p-1 hover:bg-muted"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                  className="rounded-full border border-border p-1 hover:bg-muted"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">
                {selected.currency} {totalPrice.toFixed(2)}
              </span>
            </div>

            {result?.error && (
              <p className="text-sm text-red-600">{result.error}</p>
            )}

            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                `Buy ${quantity} Ticket${quantity > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
