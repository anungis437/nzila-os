'use server'

import {
  listInvoices,
  getInvoiceById,
  getInvoiceByRef,
  listInvoiceLines,
  createInvoice,
  updateInvoice,
  createInvoiceLine,
  updateInvoiceLine,
  deleteInvoiceLine,
} from '@nzila/commerce-db'
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return {
    entityId: orgId,
    actorId: userId,
    actorRole: 'user',
  }
}

async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return { entityId: orgId }
}

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getInvoicesAction(opts?: {
  limit?: number
  offset?: number
  status?: string
  customerId?: string
}) {
  const ctx = await getReadContext()
  return listInvoices(ctx, opts)
}

export async function getInvoiceAction(invoiceId: string) {
  const ctx = await getReadContext()
  return getInvoiceById(ctx, invoiceId)
}

export async function getInvoiceByRefAction(ref: string) {
  const ctx = await getReadContext()
  return getInvoiceByRef(ctx, ref)
}

export async function getInvoiceLinesAction(invoiceId: string) {
  const ctx = await getReadContext()
  return listInvoiceLines(ctx, invoiceId)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createInvoiceAction(data: {
  orderId: string
  customerId: string
  ref: string
  currency?: string
  subtotal: string
  taxTotal: string
  total: string
  amountDue: string
  dueDate?: Date | null
  notes?: string | null
}) {
  const ctx = await getDbContext()
  return createInvoice(ctx, { ...data, createdBy: ctx.actorId })
}

export async function updateInvoiceAction(
  invoiceId: string,
  data: Partial<{
    status: string
    notes: string | null
    dueDate: Date | null
    paidAt: Date | null
    amountPaid: string
    amountDue: string
  }>,
) {
  const ctx = await getDbContext()
  return updateInvoice(ctx, invoiceId, data)
}

export async function createInvoiceLineAction(
  invoiceId: string,
  data: {
    orderLineId?: string | null
    description: string
    quantity: number
    unitPrice: string
    lineTotal: string
    sortOrder?: number
  },
) {
  const ctx = await getDbContext()
  return createInvoiceLine(ctx, { invoiceId, ...data })
}

export async function updateInvoiceLineAction(
  lineId: string,
  data: Partial<{
    description: string
    quantity: number
    unitPrice: string
    lineTotal: string
    sortOrder: number
  }>,
) {
  const ctx = await getDbContext()
  return updateInvoiceLine(ctx, lineId, data)
}

export async function deleteInvoiceLineAction(lineId: string) {
  const ctx = await getDbContext()
  return deleteInvoiceLine(ctx, lineId)
}
