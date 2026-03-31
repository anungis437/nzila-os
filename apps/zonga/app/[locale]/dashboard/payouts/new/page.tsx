'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listCreators } from '@/lib/actions/creator-actions'
import { previewPayout, executePayout } from '@/lib/actions/payout-actions'

interface CreatorOption {
  id: string
  name?: string
  email?: string
}

interface PayoutPreviewData {
  creatorId: string
  grossAmount: number
  platformFee: number
  netAmount: number
  currency: string
}

const PAYOUT_RAILS = [
  { label: 'Stripe (Card)', value: 'stripe_connect' },
  { label: 'M-Pesa (Safaricom)', value: 'mpesa' },
  { label: 'MTN Mobile Money', value: 'mtn_momo' },
  { label: 'Airtel Money', value: 'airtel_money' },
  { label: 'Orange Money', value: 'orange_money' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Chipper Cash', value: 'chipper_cash' },
  { label: 'Flutterwave', value: 'flutterwave' },
  { label: 'Vodacom M-Pesa', value: 'vodacom_mpesa' },
  { label: 'Moov Money', value: 'moov_money' },
  { label: 'Wave', value: 'wave' },
  { label: 'EcoCash', value: 'ecocash' },
  { label: 'Paga', value: 'paga' },
  { label: 'Paystack', value: 'paystack' },
]

export default function NewPayoutPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [creators, setCreators] = useState<CreatorOption[]>([])
  const [selectedCreator, setSelectedCreator] = useState('')
  const [preview, setPreview] = useState<PayoutPreviewData | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    async function load() {
      const result = await listCreators({ pageSize: 500 })
      setCreators(result.creators)
    }
    load()
  }, [])

  function handlePreview() {
    if (!selectedCreator) return
    setError(null)
    setPreview(null)

    startTransition(async () => {
      const p = await previewPayout(selectedCreator)
      if (!p) {
        setError('No pending balance for this creator.')
        return
      }
      setPreview(p as unknown as PayoutPreviewData)
    })
  }

  function handleExecute() {
    if (!selectedCreator || !preview) return
    setError(null)

    startTransition(async () => {
      const res = await executePayout({
        creatorId: selectedCreator,
        amount: preview.netAmount,
        currency: preview.currency,
        creatorName: creators.find((c) => c.id === selectedCreator)?.name,
      })

      if (!res.success) {
        setError('Payout could not be processed. Check the artist\'s payout rail configuration and try again, or contact support.')
        return
      }
      router.push('../payouts')
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">New Payout</h1>

      <Card>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Select Artist</label>
            <select
              value={selectedCreator}
              onChange={(e) => {
                setSelectedCreator(e.target.value)
                setPreview(null)
                setConfirmed(false)
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
            >
              <option value="">Choose an artist…</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? 'Unnamed'} — {c.email ?? c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Payout Rail</label>
            <select className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent">
              {PAYOUT_RAILS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {!preview && (
            <button
              type="button"
              disabled={isPending || !selectedCreator}
              onClick={handlePreview}
              className="bg-navy text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy/90 transition disabled:opacity-50"
            >
              {isPending ? 'Loading…' : 'Preview Payout'}
            </button>
          )}

          {/* Preview Card */}
          {preview && (
            <div className="rounded-lg border border-electric/20 bg-electric/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Payout Preview</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Gross Amount</p>
                  <p className="font-medium text-foreground">
                    {preview.currency} {preview.grossAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Service Fee</p>
                  <p className="font-medium text-red-500">
                    − {preview.currency} {(preview.platformFee * 0.8).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Processing Fee</p>
                  <p className="font-medium text-red-500">
                    − {preview.currency} {(preview.platformFee * 0.2).toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2 border-t pt-2">
                  <p className="text-xs text-muted-foreground">Net Payout</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {preview.currency} {preview.netAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded border-border text-electric focus:ring-electric"
                />
                I confirm this payout
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {preview && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isPending || !confirmed}
                onClick={handleExecute}
                className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
              >
                {isPending ? 'Processing…' : 'Execute Payout'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
