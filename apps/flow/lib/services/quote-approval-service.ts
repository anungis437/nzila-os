/**
 * ShopMoiCa Quote Approval Service
 *
 * Handles the customer-facing approval flow: accepting quotes and requesting revisions.
 * Coordinates share link validation, state transitions, and audit events.
 */
import { SubmitApprovalInput } from '@/lib/schemas/workflow-schemas'
import type { QuoteApproval, QuoteRevision } from '@/lib/schemas/workflow-schemas'
import { validateShareLink, markShareLinkUsed } from '@/lib/services/share-link-service'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { approvalRepo, revisionRepo, recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { quoteRepo } from '@/lib/db'
import { logger } from '@/lib/logger'
import { SHOPMOICA_BRANDING } from '@nzila/platform-commerce-org/defaults'

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + SHOPMOICA_BRANDING.hashSalt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Response Types ─────────────────────────────────────────────────────────

export interface ApprovalResult {
  ok: boolean
  action?: 'ACCEPT' | 'REQUEST_REVISION'
  error?: string
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Process a customer's approval/revision submission via share link token.
 */
export async function processQuoteApproval(
  rawToken: string,
  input: unknown,
  clientIp?: string,
): Promise<ApprovalResult> {
  // 1. Validate token
  const linkResult = await validateShareLink(rawToken)
  if (!linkResult.ok) {
    return { ok: false, error: linkResult.reason }
  }
  const { link } = linkResult

  // 2. Validate input
  const parsed = SubmitApprovalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid submission data' }
  }

  // 3. Load quote
  const quote = await quoteRepo.findById(link.quoteId)
  if (!quote) {
    return { ok: false, error: 'Quote not found' }
  }

  const currentStatus = quote.status.toUpperCase()
  if (currentStatus !== 'SENT_TO_CLIENT') {
    return {
      ok: false,
      error: 'This quote is no longer awaiting a response',
    }
  }

  // 4. Determine target status
  const targetStatus = parsed.data.action === 'ACCEPT' ? 'ACCEPTED' : 'REVISION_REQUESTED'

  // 5. Validate transition
  const transition = attemptQuoteTransition(
    currentStatus as 'SENT_TO_CLIENT',
    targetStatus,
  )
  if (!transition.ok) {
    return { ok: false, error: transition.reason }
  }

  // 6. Update quote status
  await quoteRepo.update(quote.id, { status: targetStatus })

  // 7. Record approval
  const ipHash = clientIp ? await hashIp(clientIp) : null
  const approval: QuoteApproval = {
    id: crypto.randomUUID(),
    quoteId: quote.id,
    action: parsed.data.action,
    customerName: parsed.data.customerName,
    customerEmail: parsed.data.customerEmail,
    message: parsed.data.message ?? '',
    createdAt: new Date(),
    sourceIpHash: ipHash,
    shareLinkId: link.id,
  }
  await approvalRepo.save(approval)

  // 8. If revision requested, create revision record
  if (parsed.data.action === 'REQUEST_REVISION') {
    const revision: QuoteRevision = {
      id: crypto.randomUUID(),
      quoteId: quote.id,
      requestedBy: parsed.data.customerName,
      requestMessage: parsed.data.message || 'Revision requested',
      createdAt: new Date(),
      resolvedAt: null,
      status: 'OPEN',
    }
    await revisionRepo.save(revision)
  }

  // 9. Mark share link as used
  await markShareLinkUsed(link.id)

  // 10. Record timeline event
  await recordTimelineEvent({
    quoteId: quote.id,
    event: parsed.data.action === 'ACCEPT' ? 'accepted' : 'revision_requested',
    description:
      parsed.data.action === 'ACCEPT'
        ? `Quote accepted by ${parsed.data.customerName}`
        : `Revision requested by ${parsed.data.customerName}`,
    actor: parsed.data.customerEmail,
    metadata: { approvalId: approval.id },
  })

  // 11. Emit audit event
  const auditEvent =
    parsed.data.action === 'ACCEPT'
      ? 'quote_accepted_by_client' as const
      : 'quote_revision_requested' as const

  emitWorkflowAuditEvent({
    event: auditEvent,
    quoteId: quote.id,
    orgId: quote.orgId,
    userId: parsed.data.customerEmail,
    metadata: {
      customerName: parsed.data.customerName,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      shareLinkId: link.id,
    },
  })

  // 12. Log share link viewed event
  emitWorkflowAuditEvent({
    event: 'quote_share_link_viewed',
    quoteId: quote.id,
    orgId: quote.orgId,
    userId: parsed.data.customerEmail,
    metadata: { shareLinkId: link.id },
  })

  logger.info('Quote approval processed', {
    quoteId: quote.id,
    action: parsed.data.action,
    customerEmail: parsed.data.customerEmail,
  })

  return { ok: true, action: parsed.data.action }
}

/**
 * Mark a revision as addressed by internal staff.
 */
export async function addressRevision(
  revisionId: string,
  quoteId: string,
  orgId: string,
  userId: string,
): Promise<void> {
  await revisionRepo.updateStatus(revisionId, 'ADDRESSED')

  emitWorkflowAuditEvent({
    event: 'quote_revision_addressed',
    quoteId,
    orgId,
    userId,
  })

  await recordTimelineEvent({
    quoteId,
    event: 'revision_addressed',
    description: 'Revision request addressed by staff',
    actor: userId,
    metadata: { revisionId },
  })
}
