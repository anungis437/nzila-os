/**
 * ShopMoiCa — Customer Quote Portal
 *
 * Secure, token-based page where customers can view their quote
 * and either accept or request a revision.
 * No authentication required — access controlled by secure share link token.
 */
import { notFound } from 'next/navigation'
import { validateShareLink } from '@/lib/services/share-link-service'
import { quoteRepo, customerRepo } from '@/lib/db'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { QuoteApprovalForm } from './approval-form'
import { getOrgSettings, getOrgBranding } from '@nzila/platform-commerce-org/service'
import type { OrgCommerceSettings } from '@nzila/platform-commerce-org/types'

function makeFmt(settings: OrgCommerceSettings) {
  return (n: number) =>
    new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency }).format(n)
}

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Validate the share link token
  const result = await validateShareLink(token)

  if (!result.ok) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-600 mb-4">{result.reason}</p>
          <p className="text-sm text-gray-500">
            Please contact the sender for a new link.
          </p>
        </div>
      </div>
    )
  }

  const { link } = result

  // Load quote data
  const quote = await quoteRepo.findById(link.quoteId)
  if (!quote) notFound()

  const customer = quote.customerId
    ? await customerRepo.findById(quote.customerId)
    : null

  const quoteStatus = quote.status.toUpperCase()
  const isAwaitingResponse = quoteStatus === 'SENT_TO_CLIENT'
  const isAccepted = quoteStatus === 'ACCEPTED'
  const isRevisionRequested = quoteStatus === 'REVISION_REQUESTED'

  // Emit view audit event
  emitWorkflowAuditEvent({
    event: 'quote_share_link_viewed',
    quoteId: quote.id,
    orgId: quote.orgId,
    userId: 'customer',
    metadata: { shareLinkId: link.id },
  })

  const settings = await getOrgSettings(quote.orgId)
  const branding = await getOrgBranding(quote.orgId)
  const fmt = makeFmt(settings)

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + quote.validUntilDays)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Branding */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{branding.logoInitials}</span>
            </div>
            <span className="font-semibold text-gray-900">{branding.displayName}</span>
          </div>
          <span className="text-sm text-gray-500">Quote {quote.reference}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Status banner */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-800 font-medium">This quote has been accepted. Thank you!</p>
          </div>
        )}

        {isRevisionRequested && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
            </svg>
            <p className="text-amber-800 font-medium">A revision has been requested. We will update this quote shortly.</p>
          </div>
        )}

        {/* Quote header */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quote.reference}</h1>
              <p className="text-sm text-gray-500 mt-1">{quote.title}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Valid until</p>
              <p className="font-medium text-gray-900">
                {validUntil.toLocaleDateString(settings.locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </section>

        {/* Client details */}
        {customer && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Prepared For
            </h2>
            <p className="font-medium text-gray-900">{customer.name}</p>
            {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
            {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
          </section>
        )}

        {/* Line items */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Products &amp; Services
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-2 font-medium text-gray-500">Description</th>
                <th className="text-right px-6 py-2 font-medium text-gray-500">Qty</th>
                <th className="text-right px-6 py-2 font-medium text-gray-500">Unit Price</th>
                <th className="text-right px-6 py-2 font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-50">
                  <td className="px-6 py-3 text-gray-900">{line.description}</td>
                  <td className="px-6 py-3 text-right text-gray-900">{line.quantity}</td>
                  <td className="px-6 py-3 text-right text-gray-900 font-mono">{fmt(line.unitCost)}</td>
                  <td className="px-6 py-3 text-right text-gray-900 font-mono">
                    {fmt(line.quantity * line.unitCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pricing summary */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="max-w-xs ml-auto space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono">{fmt(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{settings.taxConfig.taxes[0]?.label ?? 'Tax 1'}</span>
                <span className="font-mono">{fmt(quote.gst)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{settings.taxConfig.taxes[1]?.label ?? 'Tax 2'}</span>
                <span className="font-mono">{fmt(quote.qst)}</span>
              </div>
              <div className="border-t border-gray-300 pt-1 flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span>
                <span className="font-mono">{fmt(quote.total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notes
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">{quote.notes}</p>
          </section>
        )}

        {/* Approval / Revision Form */}
        {isAwaitingResponse && (
          <QuoteApprovalForm token={token} quoteRef={quote.reference} displayName={branding.displayName} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} {branding.displayName}. All rights reserved.</p>
          <p className="mt-1">This is a secure, time-limited quote link.</p>
        </div>
      </footer>
    </div>
  )
}
