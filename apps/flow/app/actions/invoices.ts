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
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

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
  const result = await createInvoice(ctx, { ...data, createdBy: ctx.actorId })
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVOICE_CREATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { orderId: data.orderId } }))
  return result
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
  const result = await updateInvoice(ctx, invoiceId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVOICE_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { invoiceId } }))
  return result
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
  const result = await createInvoiceLine(ctx, { invoiceId, ...data })
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVOICE_LINE_CREATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { invoiceId } }))
  return result
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
  const result = await updateInvoiceLine(ctx, lineId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVOICE_LINE_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}

export async function deleteInvoiceLineAction(lineId: string) {
  const ctx = await getDbContext()
  const result = await deleteInvoiceLine(ctx, lineId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVOICE_LINE_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { lineId } }))
  return result
}
