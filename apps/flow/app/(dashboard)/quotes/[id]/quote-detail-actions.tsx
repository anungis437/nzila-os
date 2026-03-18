'use client'

/**
 * ShopMoiCa — Quote Detail Actions (Client Component)
 *
 * Provides workflow action buttons on quote detail page:
 * Submit for Review, Send to Client, Copy Approval Link, etc.
 */
import { useState } from 'react'
import {
  PaperAirplaneIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { triggerSalesToProcurementAction } from '@/app/actions/workflow-triggers'

interface QuoteDetailActionsProps {
  quoteId: string
  status: string
}

export function QuoteDetailActions({ quoteId, status }: QuoteDetailActionsProps) {
  const [sending, setSending] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [poResult, setPoResult] = useState<{ ok: boolean; poId?: string; error?: string } | null>(null)

  async function handleConvertToPO() {
    setSending(true)
    setError(null)
    setPoResult(null)
    try {
      const result = await triggerSalesToProcurementAction(quoteId)
      setPoResult(result)
      if (!result.ok) setError(result.error ?? 'Failed to create PO')
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  async function handleSendToClient() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, expiresInDays: 7 }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to send' }))
        setError(body.error)
        return
      }

      const body = await res.json()
      setLinkUrl(body.shareLinkUrl)
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  async function handleSubmitForReview() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to submit' }))
        setError(body.error)
        return
      }

      window.location.reload()
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  async function handleCopyLink() {
    if (!linkUrl) return
    await navigator.clipboard.writeText(linkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
          data-testid="duplicate-quote-btn"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Duplicate
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
          data-testid="edit-quote-btn"
        >
          <PencilIcon className="h-4 w-4" />
          Edit
        </button>

        {status === 'DRAFT' && (
          <button
            onClick={handleSubmitForReview}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-navy rounded-lg hover:bg-navy/90 transition shadow-sm disabled:opacity-50"
            data-testid="submit-review-btn"
          >
            Submit for Review
          </button>
        )}

        {(status === 'INTERNAL_REVIEW' || status === 'REVISION_REQUESTED') && (
          <button
            onClick={handleSendToClient}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-electric rounded-lg hover:bg-electric/90 transition shadow-sm disabled:opacity-50"
            data-testid="send-to-client-btn"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send to Client'}
          </button>
        )}

        {(status === 'ACCEPTED' || status === 'READY_FOR_PO') && (
          <button
            onClick={handleConvertToPO}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition shadow-sm disabled:opacity-50"
            data-testid="convert-to-po-btn"
          >
            <TruckIcon className="h-4 w-4" />
            {sending ? 'Creating…' : 'Convert to PO'}
          </button>
        )}

        {linkUrl && (
          <>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-electric bg-electric/5 border border-electric/20 rounded-lg hover:bg-electric/10 transition"
              data-testid="copy-link-btn"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition"
              data-testid="preview-client-view-btn"
            >
              <EyeIcon className="h-4 w-4" />
              Preview Client View
            </a>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      {linkUrl && !error && (
        <p className="text-xs text-emerald-600 font-medium">Approval link generated successfully</p>
      )}

      {poResult?.ok && (
        <p className="text-xs text-emerald-600 font-medium">
          PO created successfully.{' '}
          <a href={`/purchase-orders/${poResult.poId}`} className="underline hover:text-emerald-700">View PO →</a>
        </p>
      )}
    </div>
  )
}
