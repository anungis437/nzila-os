'use server'

/**
 * Financial Server Actions
 *
 * Next.js server actions for invoicing and financial reporting.
 */

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import {
  createInvoiceFromOrder,
  getInvoice,
  listInvoices,
  issueInvoice,
  sendInvoice,
  voidInvoice,
  recordPayment,
  getPaymentsByInvoice,
  getFinancialSummary,
  getAgingReport,
  getRevenueRecognition,
  type InvoiceWithDetails,
  type InvoiceStatus,
  type FinancialSummary,
  type AgingReport,
  type RevenueRecognition,
} from './financial-service'
import { commerceInvoices, commercePayments } from '@nzila/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function createInvoiceFromOrderAction(input: {
  orderId: string
  dueDate?: string
  notes?: string
}): Promise<ActionResult<InvoiceWithDetails>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const data = await createInvoiceFromOrder({
      entityId,
      orderId: input.orderId,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      notes: input.notes,
      userId,
    })

    revalidatePath('/invoices')
    revalidatePath(`/orders/${input.orderId}`)

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    }
  }
}

export async function getInvoiceAction(
  invoiceId: string,
): Promise<ActionResult<InvoiceWithDetails>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const data = await getInvoice(invoiceId)
    if (!data) {
      return { success: false, error: 'Invoice not found' }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get invoice',
    }
  }
}

export async function listInvoicesAction(filter?: {
  status?: InvoiceStatus | InvoiceStatus[]
  customerId?: string
  dateFrom?: string
  dateTo?: string
  overdue?: boolean
}): Promise<ActionResult<InvoiceWithDetails[]>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const invoices = await listInvoices({
      entityId,
      status: filter?.status,
      customerId: filter?.customerId,
      dateFrom: filter?.dateFrom ? new Date(filter.dateFrom) : undefined,
      dateTo: filter?.dateTo ? new Date(filter.dateTo) : undefined,
      overdue: filter?.overdue,
    })

    return { success: true, data: invoices }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list invoices',
    }
  }
}

export async function issueInvoiceAction(
  invoiceId: string,
): Promise<ActionResult<typeof commerceInvoices.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const invoice = await issueInvoice(invoiceId)

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return { success: true, data: invoice }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue invoice',
    }
  }
}

export async function sendInvoiceAction(
  invoiceId: string,
): Promise<ActionResult<typeof commerceInvoices.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const invoice = await sendInvoice(invoiceId)

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return { success: true, data: invoice }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invoice',
    }
  }
}

export async function voidInvoiceAction(
  invoiceId: string,
  reason?: string,
): Promise<ActionResult<typeof commerceInvoices.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const invoice = await voidInvoice(invoiceId, reason)

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return { success: true, data: invoice }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to void invoice',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPaymentAction(input: {
  invoiceId: string
  amount: number
  method: string
  reference?: string
  paidAt?: string
}): Promise<ActionResult<typeof commercePayments.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const payment = await recordPayment({
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
    })

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${input.invoiceId}`)
    revalidatePath('/finances')

    return { success: true, data: payment }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment',
    }
  }
}

export async function getPaymentsByInvoiceAction(
  invoiceId: string,
): Promise<ActionResult<(typeof commercePayments.$inferSelect)[]>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const payments = await getPaymentsByInvoice(invoiceId)

    return { success: true, data: payments }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payments',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getFinancialSummaryAction(input?: {
  from?: string
  to?: string
}): Promise<ActionResult<FinancialSummary>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    // Default to current year if not specified
    const now = new Date()
    const from = input?.from ? new Date(input.from) : new Date(now.getFullYear(), 0, 1)
    const to = input?.to ? new Date(input.to) : now

    const summary = await getFinancialSummary(entityId, from, to)

    return { success: true, data: summary }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get financial summary',
    }
  }
}

export async function getAgingReportAction(): Promise<ActionResult<AgingReport>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const report = await getAgingReport(entityId)

    return { success: true, data: report }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get aging report',
    }
  }
}

export async function getRevenueRecognitionAction(input?: {
  from?: string
  to?: string
}): Promise<ActionResult<RevenueRecognition>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const now = new Date()
    const from = input?.from ? new Date(input.from) : new Date(now.getFullYear(), 0, 1)
    const to = input?.to ? new Date(input.to) : now

    const report = await getRevenueRecognition(entityId, from, to)

    return { success: true, data: report }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get revenue recognition report',
    }
  }
}
