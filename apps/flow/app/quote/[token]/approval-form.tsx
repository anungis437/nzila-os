'use client'

/**
 * ShopMoiCa — Quote Approval Form (Client Component)
 *
 * Client-side form for customers to accept a quote or request a revision.
 * Renders within the customer quote portal page.
 */
import { useState } from 'react'

interface QuoteApprovalFormProps {
  token: string
  quoteRef: string
  displayName: string
}

export function QuoteApprovalForm({ token, quoteRef, displayName }: QuoteApprovalFormProps) {
  const [mode, setMode] = useState<'choose' | 'accept' | 'revision' | 'submitted'>('choose')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [paymentPreference, setPaymentPreference] = useState<'full' | 'deposit'>('full')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(action: 'ACCEPT' | 'REQUEST_REVISION') {
    if (!name.trim() || !email.trim()) {
      setError('Please provide your name and email.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const composedMessage = [
        message.trim(),
        action === 'ACCEPT' && signatureName.trim() ? `Signature: ${signatureName.trim()}` : '',
        action === 'ACCEPT' ? `Payment preference: ${paymentPreference}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const res = await fetch(`/api/quote/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          customerName: name.trim(),
          customerEmail: email.trim(),
          message: composedMessage,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Submission failed' }))
        setError(body.error ?? 'Submission failed')
        return
      }

      setMode('submitted')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'submitted') {
    return (
      <section className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-green-900 mb-2">Response Submitted</h2>
        <p className="text-green-700">
          Thank you! Your response to quote {quoteRef} has been recorded.
          The {displayName} team will be in touch.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Respond to This Quote</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Contact fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="approval-name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            id="approval-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Full name"
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="approval-email" className="block text-sm font-medium text-gray-700 mb-1">
            Your Email
          </label>
          <input
            id="approval-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="email@company.com"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Mode: choose action */}
      {mode === 'choose' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setMode('accept')}
            className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
            disabled={submitting}
            data-testid="approve-quote-btn"
          >
            Accept Quote
          </button>
          <button
            onClick={() => setMode('revision')}
            className="flex-1 px-4 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition"
            disabled={submitting}
            data-testid="request-revision-btn"
          >
            Request Revision
          </button>
        </div>
      )}

      {/* Mode: accept confirmation */}
      {mode === 'accept' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Speed-to-close options: add an e-signature placeholder and preferred payment structure.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="signature-name" className="block text-sm font-medium text-gray-700 mb-1">
                E-signature name
              </label>
              <input
                id="signature-name"
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Type legal name"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="payment-preference" className="block text-sm font-medium text-gray-700 mb-1">
                Payment preference
              </label>
              <select
                id="payment-preference"
                value={paymentPreference}
                onChange={(e) => setPaymentPreference(e.target.value as 'full' | 'deposit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={submitting}
              >
                <option value="full">Pay full amount on acceptance</option>
                <option value="deposit">Pay 50% deposit, remainder on completion</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="accept-message" className="block text-sm font-medium text-gray-700 mb-1">
              Message (optional)
            </label>
            <textarea
              id="accept-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Any additional notes..."
              disabled={submitting}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
            <span>Download branded PDF contract</span>
            <a
              href={`#quote-${quoteRef}-pdf`}
              className="text-purple-700 font-medium hover:underline"
            >
              Generate PDF
            </a>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit('ACCEPT')}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              data-testid="confirm-accept-btn"
            >
              {submitting ? 'Submitting...' : 'Confirm Acceptance'}
            </button>
            <button
              onClick={() => setMode('choose')}
              disabled={submitting}
              className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Mode: request revision */}
      {mode === 'revision' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="revision-message" className="block text-sm font-medium text-gray-700 mb-1">
              What changes are needed?
            </label>
            <textarea
              id="revision-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={4}
              placeholder="Please describe the changes you'd like..."
              disabled={submitting}
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit('REQUEST_REVISION')}
              disabled={submitting || !message.trim()}
              className="flex-1 px-4 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
              data-testid="confirm-revision-btn"
            >
              {submitting ? 'Submitting...' : 'Submit Revision Request'}
            </button>
            <button
              onClick={() => setMode('choose')}
              disabled={submitting}
              className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
