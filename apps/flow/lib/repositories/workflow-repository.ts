/**
 * ShopMoiCa Workflow Repository
 *
 * Drizzle-backed repositories for quote approvals, revisions, payment
 * requirements, payment status, payment events, and timeline events.
 *
 * All workflow data persists across server restarts in PostgreSQL.
 */
import {
  db,
  commerceQuoteApprovals,
  commerceQuoteRevisions,
  commercePaymentRequirements,
  commercePaymentTracking,
  commercePaymentEvents,
  commerceTimelineEvents,
} from '@nzila/db'
import { eq, desc } from 'drizzle-orm'
import type {
  QuoteApproval,
  QuoteRevision,
  QuotePaymentRequirement,
  QuotePaymentStatus,
  PaymentEvent,
  TimelineEvent,
  RevisionStatus,
} from '@/lib/schemas/workflow-schemas'

// ── Approval Repository ───────────────────────────────────────────────────

export const approvalRepo = {
  async save(approval: QuoteApproval): Promise<void> {
    await db
      .insert(commerceQuoteApprovals)
      .values({
        id: approval.id,
        orgId: (approval as QuoteApproval & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: approval.quoteId,
        action: approval.action,
        customerName: approval.customerName,
        customerEmail: approval.customerEmail,
        message: approval.message ?? '',
        sourceIpHash: approval.sourceIpHash ?? null,
        shareLinkId: approval.shareLinkId,
        createdAt: approval.createdAt,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<QuoteApproval[]> {
    const rows = await db
      .select()
      .from(commerceQuoteApprovals)
      .where(eq(commerceQuoteApprovals.quoteId, quoteId))
      .orderBy(desc(commerceQuoteApprovals.createdAt))

    return rows.map(mapApprovalRow)
  },

  async findById(id: string): Promise<QuoteApproval | undefined> {
    const [row] = await db
      .select()
      .from(commerceQuoteApprovals)
      .where(eq(commerceQuoteApprovals.id, id))
      .limit(1)
    return row ? mapApprovalRow(row) : undefined
  },
}

function mapApprovalRow(row: typeof commerceQuoteApprovals.$inferSelect): QuoteApproval {
  return {
    id: row.id,
    quoteId: row.quoteId,
    action: row.action as 'ACCEPT' | 'REQUEST_REVISION',
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    message: row.message ?? '',
    sourceIpHash: row.sourceIpHash ?? null,
    shareLinkId: row.shareLinkId,
    createdAt: row.createdAt,
  }
}

// ── Revision Repository ───────────────────────────────────────────────────

export const revisionRepo = {
  async save(revision: QuoteRevision): Promise<void> {
    await db
      .insert(commerceQuoteRevisions)
      .values({
        id: revision.id,
        orgId: (revision as QuoteRevision & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: revision.quoteId,
        requestedBy: revision.requestedBy,
        requestMessage: revision.requestMessage,
        status: revision.status,
        resolvedAt: revision.resolvedAt ?? null,
        createdAt: revision.createdAt,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<QuoteRevision[]> {
    const rows = await db
      .select()
      .from(commerceQuoteRevisions)
      .where(eq(commerceQuoteRevisions.quoteId, quoteId))
      .orderBy(desc(commerceQuoteRevisions.createdAt))

    return rows.map(mapRevisionRow)
  },

  findOpenByQuoteId(quoteId: string): Promise<QuoteRevision[]> {
    return this.findByQuoteId(quoteId).then((revisions) =>
      revisions.filter((r) => r.status === 'OPEN'),
    )
  },

  async updateStatus(id: string, status: RevisionStatus): Promise<void> {
    await db
      .update(commerceQuoteRevisions)
      .set({
        status,
        resolvedAt: status !== 'OPEN' ? new Date() : null,
      })
      .where(eq(commerceQuoteRevisions.id, id))
  },
}

function mapRevisionRow(row: typeof commerceQuoteRevisions.$inferSelect): QuoteRevision {
  return {
    id: row.id,
    quoteId: row.quoteId,
    requestedBy: row.requestedBy,
    requestMessage: row.requestMessage,
    status: row.status as 'OPEN' | 'ADDRESSED' | 'CLOSED',
    resolvedAt: row.resolvedAt ?? null,
    createdAt: row.createdAt,
  }
}

// ── Payment Requirement Repository ─────────────────────────────────────────

export const paymentRequirementRepo = {
  async save(req: QuotePaymentRequirement): Promise<void> {
    await db
      .insert(commercePaymentRequirements)
      .values({
        id: req.id,
        orgId: (req as QuotePaymentRequirement & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: req.quoteId,
        depositRequired: req.depositRequired,
        depositPercent: req.depositPercent != null ? String(req.depositPercent) : null,
        depositAmount: req.depositAmount != null ? String(req.depositAmount) : null,
        dueBeforeProduction: req.dueBeforeProduction,
        createdAt: req.createdAt,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<QuotePaymentRequirement | undefined> {
    const [row] = await db
      .select()
      .from(commercePaymentRequirements)
      .where(eq(commercePaymentRequirements.quoteId, quoteId))
      .limit(1)
    if (!row) return undefined
    return {
      id: row.id,
      quoteId: row.quoteId,
      depositRequired: row.depositRequired,
      depositPercent: row.depositPercent ? Number(row.depositPercent) : null,
      depositAmount: row.depositAmount ? Number(row.depositAmount) : null,
      dueBeforeProduction: row.dueBeforeProduction,
      createdAt: row.createdAt,
    }
  },
}

// ── Payment Status Repository ──────────────────────────────────────────────

export const paymentStatusRepo = {
  async save(status: QuotePaymentStatus): Promise<void> {
    await db
      .insert(commercePaymentTracking)
      .values({
        id: status.id,
        orgId: (status as QuotePaymentStatus & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: status.quoteId,
        status: status.status,
        amountDue: String(status.amountDue),
        amountPaid: String(status.amountPaid),
        updatedAt: status.updatedAt,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<QuotePaymentStatus | undefined> {
    const [row] = await db
      .select()
      .from(commercePaymentTracking)
      .where(eq(commercePaymentTracking.quoteId, quoteId))
      .limit(1)
    if (!row) return undefined
    return mapPaymentStatusRow(row)
  },

  async upsertForQuote(quoteId: string, update: Partial<QuotePaymentStatus>): Promise<QuotePaymentStatus> {
    const existing = await this.findByQuoteId(quoteId)

    if (existing) {
      const newStatus = update.status ?? existing.status
      const newAmountDue = update.amountDue ?? existing.amountDue
      const newAmountPaid = update.amountPaid ?? existing.amountPaid

      await db
        .update(commercePaymentTracking)
        .set({
          status: newStatus,
          amountDue: String(newAmountDue),
          amountPaid: String(newAmountPaid),
          updatedAt: new Date(),
        })
        .where(eq(commercePaymentTracking.id, existing.id))

      return {
        ...existing,
        status: newStatus,
        amountDue: newAmountDue,
        amountPaid: newAmountPaid,
        updatedAt: new Date(),
      }
    }

    const newRecord: QuotePaymentStatus = {
      id: crypto.randomUUID(),
      quoteId,
      status: update.status ?? 'NOT_REQUIRED',
      amountDue: update.amountDue ?? 0,
      amountPaid: update.amountPaid ?? 0,
      updatedAt: new Date(),
    }

    await db
      .insert(commercePaymentTracking)
      .values({
        id: newRecord.id,
        orgId: (update as Partial<QuotePaymentStatus> & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId,
        status: newRecord.status,
        amountDue: String(newRecord.amountDue),
        amountPaid: String(newRecord.amountPaid),
        updatedAt: newRecord.updatedAt,
      })

    return newRecord
  },
}

function mapPaymentStatusRow(row: typeof commercePaymentTracking.$inferSelect): QuotePaymentStatus {
  return {
    id: row.id,
    quoteId: row.quoteId,
    status: row.status as QuotePaymentStatus['status'],
    amountDue: Number(row.amountDue),
    amountPaid: Number(row.amountPaid),
    updatedAt: row.updatedAt,
  }
}

// ── Payment Event Repository ───────────────────────────────────────────────

export const paymentEventRepo = {
  async save(event: PaymentEvent): Promise<void> {
    await db
      .insert(commercePaymentEvents)
      .values({
        id: event.id,
        orgId: (event as PaymentEvent & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: event.quoteId,
        eventType: event.eventType,
        amount: String(event.amount),
        providerRef: event.providerRef ?? null,
        metadata: event.metadataJson ?? {},
        createdAt: event.createdAt,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<PaymentEvent[]> {
    const rows = await db
      .select()
      .from(commercePaymentEvents)
      .where(eq(commercePaymentEvents.quoteId, quoteId))
      .orderBy(desc(commercePaymentEvents.createdAt))

    return rows.map((row) => ({
      id: row.id,
      quoteId: row.quoteId,
      eventType: row.eventType as PaymentEvent['eventType'],
      amount: Number(row.amount),
      providerRef: row.providerRef ?? null,
      metadataJson: (row.metadata as Record<string, unknown>) ?? null,
      createdAt: row.createdAt,
    }))
  },
}

// ── Timeline Event Repository ──────────────────────────────────────────────

export const timelineRepo = {
  async add(event: TimelineEvent): Promise<void> {
    await db
      .insert(commerceTimelineEvents)
      .values({
        id: event.id,
        orgId: (event as TimelineEvent & { orgId?: string }).orgId ?? '00000000-0000-0000-0000-000000000000',
        quoteId: event.quoteId,
        event: event.event,
        description: event.description,
        actor: event.actor ?? null,
        metadata: event.metadata ?? {},
        createdAt: event.timestamp,
      })
      .onConflictDoNothing()
  },

  async findByQuoteId(quoteId: string): Promise<TimelineEvent[]> {
    const rows = await db
      .select()
      .from(commerceTimelineEvents)
      .where(eq(commerceTimelineEvents.quoteId, quoteId))
      .orderBy(commerceTimelineEvents.createdAt)

    return rows.map((row) => ({
      id: row.id,
      quoteId: row.quoteId,
      event: row.event,
      description: row.description,
      actor: row.actor ?? undefined,
      timestamp: row.createdAt,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    }))
  },
}

/**
 * Record a timeline event for a quote.
 */
export async function recordTimelineEvent(input: {
  quoteId: string
  event: string
  description: string
  actor?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await timelineRepo.add({
    id: crypto.randomUUID(),
    quoteId: input.quoteId,
    event: input.event,
    description: input.description,
    actor: input.actor,
    timestamp: new Date(),
    metadata: input.metadata,
  })
}
