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
} from '@heroicons/react/24/outline'

interface QuoteDetailActionsProps {
  quoteId: string
  status: string
}

export function QuoteDetailActions({ quoteId, status }: QuoteDetailActionsProps) {
  const [sending, setSending] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          data-testid="duplicate-quote-btn"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Duplicate
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          data-testid="edit-quote-btn"
        >
          <PencilIcon className="h-4 w-4" />
          Edit
        </button>

        {status === 'DRAFT' && (
          <button
            onClick={handleSubmitForReview}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
            data-testid="submit-review-btn"
          >
            Submit for Review
          </button>
        )}

        {(status === 'INTERNAL_REVIEW' || status === 'REVISION_REQUESTED') && (
          <button
            onClick={handleSendToClient}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition shadow-sm disabled:opacity-50"
            data-testid="send-to-client-btn"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send to Client'}
          </button>
        )}

        {linkUrl && (
          <>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition"
              data-testid="copy-link-btn"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              data-testid="preview-client-view-btn"
            >
              <EyeIcon className="h-4 w-4" />
              Preview Client View
            </a>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {linkUrl && !error && (
        <p className="text-xs text-green-600">Approval link generated successfully</p>
      )}
    </div>
  )
}
