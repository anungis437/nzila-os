/**
 * Financial Reporting Service
 *
 * Handles invoicing, payments, and financial analytics.
 * Ported from legacy shop_quoter_tool_v1 mandate-financial-reporting-service.ts.
 */

import { and, eq, desc, sql, gte, lte, inArray, or } from 'drizzle-orm'
import {
  db,
  commerceInvoices,
  commerceInvoiceLines,
  commerceOrders,
  commerceOrderLines,
  commerceCustomers,
  commercePayments,
} from '@nzila/db'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'partial_paid'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'resolved'
  | 'refunded'

export interface CreateInvoiceInput {
  entityId: string
  orderId: string
  dueDate?: Date
  notes?: string
  userId: string
}

export interface InvoiceWithDetails {
  invoice: typeof commerceInvoices.$inferSelect
  customer: typeof commerceCustomers.$inferSelect
  order: typeof commerceOrders.$inferSelect
  lines: (typeof commerceInvoiceLines.$inferSelect)[]
  payments: (typeof commercePayments.$inferSelect)[]
}

export interface RecordPaymentInput {
  invoiceId: string
  amount: number
  method: string
  reference?: string
  paidAt?: Date
}

export interface FinancialSummary {
  period: { from: Date; to: Date }
  revenue: {
    totalInvoiced: number
    totalPaid: number
    totalOutstanding: number
    totalOverdue: number
  }
  invoices: {
    total: number
    draft: number
    sent: number
    paid: number
    overdue: number
    partialPaid: number
  }
  payments: {
    total: number
    byMethod: { method: string; amount: number; count: number }[]
  }
  customers: {
    totalActive: number
    topByRevenue: { customerId: string; name: string; revenue: number }[]
  }
  trends: {
    monthlyRevenue: { month: string; invoiced: number; paid: number }[]
  }
}

export interface AgingReport {
  current: { count: number; amount: number; invoices: InvoiceAging[] }
  days30: { count: number; amount: number; invoices: InvoiceAging[] }
  days60: { count: number; amount: number; invoices: InvoiceAging[] }
  days90: { count: number; amount: number; invoices: InvoiceAging[] }
  days90Plus: { count: number; amount: number; invoices: InvoiceAging[] }
  total: { count: number; amount: number }
}

export interface InvoiceAging {
  invoiceId: string
  ref: string
  customerId: string
  customerName: string
  amountDue: number
  dueDate: Date
  daysOverdue: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Number Generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateInvoiceRef(entityId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const [latest] = await db
    .select({ ref: commerceInvoices.ref })
    .from(commerceInvoices)
    .where(and(eq(commerceInvoices.entityId, entityId), sql`${commerceInvoices.ref} LIKE ${prefix + '%'}`))
    .orderBy(desc(commerceInvoices.ref))
    .limit(1)

  let nextNum = 1
  if (latest?.ref) {
    const match = latest.ref.match(/INV-\d{4}-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Management
// ─────────────────────────────────────────────────────────────────────────────

export async function createInvoiceFromOrder(input: CreateInvoiceInput): Promise<InvoiceWithDetails> {
  logger.info('Creating invoice from order', { entityId: input.entityId, orderId: input.orderId })

  // Get order with lines
  const [order] = await db.select().from(commerceOrders).where(eq(commerceOrders.id, input.orderId)).limit(1)

  if (!order) {
    throw new Error(`Order ${input.orderId} not found`)
  }

  const orderLines = await db.select().from(commerceOrderLines).where(eq(commerceOrderLines.orderId, input.orderId))

  // Get customer
  const [customer] = await db
    .select()
    .from(commerceCustomers)
    .where(eq(commerceCustomers.id, order.customerId))
    .limit(1)

  if (!customer) {
    throw new Error(`Customer ${order.customerId} not found`)
  }

  const ref = await generateInvoiceRef(input.entityId)
  const dueDate = input.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default NET 30

  // Create invoice
  const [invoice] = await db
    .insert(commerceInvoices)
    .values({
      entityId: input.entityId,
      orderId: input.orderId,
      customerId: order.customerId,
      ref,
      status: 'draft',
      currency: order.currency,
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      total: order.total,
      amountPaid: '0',
      amountDue: order.total,
      dueDate,
      notes: input.notes ?? null,
      createdBy: input.userId,
    })
    .returning()

  // Create invoice lines from order lines
  const invoiceLineValues = orderLines.map((ol, idx) => ({
    entityId: input.entityId,
    invoiceId: invoice.id,
    orderLineId: ol.id,
    description: ol.description,
    quantity: ol.quantity,
    unitPrice: ol.unitPrice,
    lineTotal: ol.lineTotal,
    sortOrder: idx,
  }))

  const lines = await db.insert(commerceInvoiceLines).values(invoiceLineValues).returning()

  logger.info('Invoice created', { invoiceId: invoice.id, ref: invoice.ref })

  return { invoice, customer, order, lines, payments: [] }
}

export async function getInvoice(invoiceId: string): Promise<InvoiceWithDetails | null> {
  const [invoice] = await db.select().from(commerceInvoices).where(eq(commerceInvoices.id, invoiceId)).limit(1)

  if (!invoice) return null

  const [customer, order, lines, payments] = await Promise.all([
    db.select().from(commerceCustomers).where(eq(commerceCustomers.id, invoice.customerId)).limit(1),
    db.select().from(commerceOrders).where(eq(commerceOrders.id, invoice.orderId)).limit(1),
    db.select().from(commerceInvoiceLines).where(eq(commerceInvoiceLines.invoiceId, invoiceId)),
    db.select().from(commercePayments).where(eq(commercePayments.invoiceId, invoiceId)),
  ])

  return {
    invoice,
    customer: customer[0],
    order: order[0],
    lines,
    payments,
  }
}

export async function issueInvoice(invoiceId: string): Promise<typeof commerceInvoices.$inferSelect> {
  const [invoice] = await db
    .select()
    .from(commerceInvoices)
    .where(and(eq(commerceInvoices.id, invoiceId), eq(commerceInvoices.status, 'draft')))
    .limit(1)

  if (!invoice) {
    throw new Error('Invoice not found or already issued')
  }

  const [updated] = await db
    .update(commerceInvoices)
    .set({
      status: 'issued',
      issuedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(commerceInvoices.id, invoiceId))
    .returning()

  logger.info('Invoice issued', { invoiceId, ref: invoice.ref })

  return updated
}

export async function sendInvoice(invoiceId: string): Promise<typeof commerceInvoices.$inferSelect> {
  const [invoice] = await db
    .select()
    .from(commerceInvoices)
    .where(and(eq(commerceInvoices.id, invoiceId), or(eq(commerceInvoices.status, 'issued'), eq(commerceInvoices.status, 'draft'))))
    .limit(1)

  if (!invoice) {
    throw new Error('Invoice not found or cannot be sent')
  }

  const updates: Record<string, unknown> = {
    status: 'sent',
    updatedAt: new Date(),
  }

  if (!invoice.issuedAt) {
    updates.issuedAt = new Date()
  }

  const [updated] = await db
    .update(commerceInvoices)
    .set(updates)
    .where(eq(commerceInvoices.id, invoiceId))
    .returning()

  logger.info('Invoice sent', { invoiceId, ref: invoice.ref })

  return updated
}

export async function voidInvoice(invoiceId: string, reason?: string): Promise<typeof commerceInvoices.$inferSelect> {
  const [invoice] = await db
    .select()
    .from(commerceInvoices)
    .where(eq(commerceInvoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  if (Number(invoice.amountPaid) > 0) {
    throw new Error('Cannot void invoice with payments. Issue a credit note or refund instead.')
  }

  const metadata = { ...(invoice.metadata as object), voidReason: reason }

  const [updated] = await db
    .update(commerceInvoices)
    .set({
      status: 'refunded', // Using refunded as void status
      metadata,
      updatedAt: new Date(),
    })
    .where(eq(commerceInvoices.id, invoiceId))
    .returning()

  logger.info('Invoice voided', { invoiceId, ref: invoice.ref, reason })

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPayment(input: RecordPaymentInput): Promise<typeof commercePayments.$inferSelect> {
  const [invoice] = await db.select().from(commerceInvoices).where(eq(commerceInvoices.id, input.invoiceId)).limit(1)

  if (!invoice) {
    throw new Error(`Invoice ${input.invoiceId} not found`)
  }

  const amountDue = Number(invoice.amountDue)
  if (input.amount > amountDue) {
    throw new Error(`Payment amount ${input.amount} exceeds amount due ${amountDue}`)
  }

  // Record payment
  const [payment] = await db
    .insert(commercePayments)
    .values({
      entityId: invoice.entityId,
      invoiceId: input.invoiceId,
      amount: input.amount.toFixed(2),
      method: input.method,
      reference: input.reference ?? null,
      paidAt: input.paidAt ?? new Date(),
    })
    .returning()

  // Update invoice
  const newAmountPaid = Number(invoice.amountPaid) + input.amount
  const newAmountDue = Number(invoice.total) - newAmountPaid
  const newStatus: InvoiceStatus = newAmountDue <= 0 ? 'paid' : 'partial_paid'

  await db
    .update(commerceInvoices)
    .set({
      amountPaid: newAmountPaid.toFixed(2),
      amountDue: newAmountDue.toFixed(2),
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(commerceInvoices.id, input.invoiceId))

  logger.info('Payment recorded', {
      paymentId: payment.id,
      invoiceId: input.invoiceId,
      amount: input.amount,
      newStatus,
    })

  return payment
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<(typeof commercePayments.$inferSelect)[]> {
  return db
    .select()
    .from(commercePayments)
    .where(eq(commercePayments.invoiceId, invoiceId))
    .orderBy(desc(commercePayments.paidAt))
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Listing
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceListFilter {
  entityId: string
  status?: InvoiceStatus | InvoiceStatus[]
  customerId?: string
  dateFrom?: Date
  dateTo?: Date
  overdue?: boolean
}

export async function listInvoices(filter: InvoiceListFilter): Promise<InvoiceWithDetails[]> {
  const conditions = [eq(commerceInvoices.entityId, filter.entityId)]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(sql`${commerceInvoices.status} = ANY(${statuses})`)
  }

  if (filter.customerId) {
    conditions.push(eq(commerceInvoices.customerId, filter.customerId))
  }

  if (filter.dateFrom) {
    conditions.push(gte(commerceInvoices.createdAt, filter.dateFrom))
  }

  if (filter.dateTo) {
    conditions.push(lte(commerceInvoices.createdAt, filter.dateTo))
  }

  if (filter.overdue) {
    conditions.push(
      and(
        sql`${commerceInvoices.dueDate} < NOW()`,
        sql`${commerceInvoices.status} NOT IN ('paid', 'refunded', 'resolved')`,
      )!,
    )
  }

  const invoices = await db
    .select()
    .from(commerceInvoices)
    .where(and(...conditions))
    .orderBy(desc(commerceInvoices.createdAt))

  // Get related data
  const invoiceIds = invoices.map((i) => i.id)
  const customerIds = [...new Set(invoices.map((i) => i.customerId))]
  const orderIds = [...new Set(invoices.map((i) => i.orderId))]

  const [lines, payments, customers, orders] = await Promise.all([
    invoiceIds.length > 0
      ? db.select().from(commerceInvoiceLines).where(inArray(commerceInvoiceLines.invoiceId, invoiceIds))
      : [],
    invoiceIds.length > 0
      ? db.select().from(commercePayments).where(inArray(commercePayments.invoiceId, invoiceIds))
      : [],
    customerIds.length > 0
      ? db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : [],
    orderIds.length > 0 ? db.select().from(commerceOrders).where(inArray(commerceOrders.id, orderIds)) : [],
  ])

  const linesMap = new Map<string, (typeof commerceInvoiceLines.$inferSelect)[]>()
  for (const line of lines) {
    const existing = linesMap.get(line.invoiceId) ?? []
    existing.push(line)
    linesMap.set(line.invoiceId, existing)
  }

  const paymentsMap = new Map<string, (typeof commercePayments.$inferSelect)[]>()
  for (const payment of payments) {
    const existing = paymentsMap.get(payment.invoiceId) ?? []
    existing.push(payment)
    paymentsMap.set(payment.invoiceId, existing)
  }

  const customerMap = new Map(customers.map((c) => [c.id, c]))
  const orderMap = new Map(orders.map((o) => [o.id, o]))

  return invoices.map((invoice) => ({
    invoice,
    customer: customerMap.get(invoice.customerId)!,
    order: orderMap.get(invoice.orderId)!,
    lines: linesMap.get(invoice.id) ?? [],
    payments: paymentsMap.get(invoice.id) ?? [],
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getFinancialSummary(
  entityId: string,
  from: Date,
  to: Date,
): Promise<FinancialSummary> {
  // Get invoices in period
  const invoices = await db
    .select()
    .from(commerceInvoices)
    .where(
      and(
        eq(commerceInvoices.entityId, entityId),
        gte(commerceInvoices.createdAt, from),
        lte(commerceInvoices.createdAt, to),
      ),
    )

  // Get payments in period
  const payments = await db
    .select()
    .from(commercePayments)
    .where(
      and(
        eq(commercePayments.entityId, entityId),
        gte(commercePayments.paidAt, from),
        lte(commercePayments.paidAt, to),
      ),
    )

  // Revenue calculations
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)

  const now = new Date()
  const overdueInvoices = invoices.filter(
    (i) => i.dueDate && i.dueDate < now && !['paid', 'refunded', 'resolved'].includes(i.status),
  )
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amountDue), 0)

  const outstandingInvoices = invoices.filter((i) => !['paid', 'refunded', 'resolved'].includes(i.status))
  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + Number(i.amountDue), 0)

  // Invoice counts by status
  const invoiceCounts = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === 'draft').length,
    sent: invoices.filter((i) => i.status === 'sent' || i.status === 'issued').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    overdue: overdueInvoices.length,
    partialPaid: invoices.filter((i) => i.status === 'partial_paid').length,
  }

  // Payments by method
  const methodMap = new Map<string, { amount: number; count: number }>()
  for (const p of payments) {
    const existing = methodMap.get(p.method) ?? { amount: 0, count: 0 }
    existing.amount += Number(p.amount)
    existing.count++
    methodMap.set(p.method, existing)
  }

  const byMethod = Array.from(methodMap.entries())
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.amount - a.amount)

  // Top customers by revenue
  const customerRevenue = new Map<string, number>()
  for (const invoice of invoices) {
    const existing = customerRevenue.get(invoice.customerId) ?? 0
    customerRevenue.set(invoice.customerId, existing + Number(invoice.amountPaid))
  }

  const customerIds = [...customerRevenue.keys()]
  const customers =
    customerIds.length > 0
      ? await db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : []

  const customerMap = new Map(customers.map((c) => [c.id, c]))

  const topCustomers = Array.from(customerRevenue.entries())
    .map(([customerId, revenue]) => ({
      customerId,
      name: customerMap.get(customerId)?.name ?? 'Unknown',
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Monthly trends
  const monthlyMap = new Map<string, { invoiced: number; paid: number }>()

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7) // YYYY-MM
    const existing = monthlyMap.get(month) ?? { invoiced: 0, paid: 0 }
    existing.invoiced += Number(invoice.total)
    monthlyMap.set(month, existing)
  }

  for (const payment of payments) {
    const month = payment.paidAt.toISOString().slice(0, 7)
    const existing = monthlyMap.get(month) ?? { invoiced: 0, paid: 0 }
    existing.paid += Number(payment.amount)
    monthlyMap.set(month, existing)
  }

  const monthlyRevenue = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    period: { from, to },
    revenue: {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalOverdue,
    },
    invoices: invoiceCounts,
    payments: {
      total: payments.length,
      byMethod,
    },
    customers: {
      totalActive: customerIds.length,
      topByRevenue: topCustomers,
    },
    trends: {
      monthlyRevenue,
    },
  }
}

export async function getAgingReport(entityId: string): Promise<AgingReport> {
  const now = new Date()

  // Get all unpaid invoices
  const invoices = await db
    .select()
    .from(commerceInvoices)
    .where(
      and(
        eq(commerceInvoices.entityId, entityId),
        sql`${commerceInvoices.status} NOT IN ('paid', 'refunded', 'resolved')`,
        sql`${commerceInvoices.amountDue} > 0`,
      ),
    )

  // Get customers
  const customerIds = [...new Set(invoices.map((i) => i.customerId))]
  const customers =
    customerIds.length > 0
      ? await db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : []

  const customerMap = new Map(customers.map((c) => [c.id, c]))

  // Categorize by aging
  const current: InvoiceAging[] = []
  const days30: InvoiceAging[] = []
  const days60: InvoiceAging[] = []
  const days90: InvoiceAging[] = []
  const days90Plus: InvoiceAging[] = []

  for (const invoice of invoices) {
    const dueDate = invoice.dueDate ?? invoice.createdAt
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))

    const aging: InvoiceAging = {
      invoiceId: invoice.id,
      ref: invoice.ref,
      customerId: invoice.customerId,
      customerName: customerMap.get(invoice.customerId)?.name ?? 'Unknown',
      amountDue: Number(invoice.amountDue),
      dueDate,
      daysOverdue,
    }

    if (daysOverdue <= 0) {
      current.push(aging)
    } else if (daysOverdue <= 30) {
      days30.push(aging)
    } else if (daysOverdue <= 60) {
      days60.push(aging)
    } else if (daysOverdue <= 90) {
      days90.push(aging)
    } else {
      days90Plus.push(aging)
    }
  }

  const sumAmount = (arr: InvoiceAging[]) => arr.reduce((s, a) => s + a.amountDue, 0)

  return {
    current: { count: current.length, amount: sumAmount(current), invoices: current },
    days30: { count: days30.length, amount: sumAmount(days30), invoices: days30 },
    days60: { count: days60.length, amount: sumAmount(days60), invoices: days60 },
    days90: { count: days90.length, amount: sumAmount(days90), invoices: days90 },
    days90Plus: { count: days90Plus.length, amount: sumAmount(days90Plus), invoices: days90Plus },
    total: {
      count: invoices.length,
      amount: sumAmount([...current, ...days30, ...days60, ...days90, ...days90Plus]),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Recognition
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueRecognition {
  period: { from: Date; to: Date }
  recognizedRevenue: number
  deferredRevenue: number
  byMonth: { month: string; recognized: number; deferred: number }[]
  byCustomer: { customerId: string; name: string; recognized: number }[]
}

export async function getRevenueRecognition(
  entityId: string,
  from: Date,
  to: Date,
): Promise<RevenueRecognition> {
  // For this simple implementation, we recognize revenue when paid
  const payments = await db
    .select()
    .from(commercePayments)
    .where(
      and(
        eq(commercePayments.entityId, entityId),
        gte(commercePayments.paidAt, from),
        lte(commercePayments.paidAt, to),
      ),
    )

  const invoiceIds = [...new Set(payments.map((p) => p.invoiceId))]
  const invoices =
    invoiceIds.length > 0
      ? await db.select().from(commerceInvoices).where(inArray(commerceInvoices.id, invoiceIds))
      : []

  const invoiceMap = new Map(invoices.map((i) => [i.id, i]))

  // Get customers
  const customerIds = [...new Set(invoices.map((i) => i.customerId))]
  const customers =
    customerIds.length > 0
      ? await db.select().from(commerceCustomers).where(inArray(commerceCustomers.id, customerIds))
      : []

  const customerMap = new Map(customers.map((c) => [c.id, c]))

  // Calculate recognized revenue
  const recognizedRevenue = payments.reduce((s, p) => s + Number(p.amount), 0)

  // Deferred revenue = outstanding invoices issued before period end
  const outstandingInvoices = await db
    .select()
    .from(commerceInvoices)
    .where(
      and(
        eq(commerceInvoices.entityId, entityId),
        lte(commerceInvoices.issuedAt, to),
        sql`${commerceInvoices.status} NOT IN ('paid', 'refunded', 'resolved')`,
      ),
    )

  const deferredRevenue = outstandingInvoices.reduce((s, i) => s + Number(i.amountDue), 0)

  // Monthly breakdown
  const monthlyMap = new Map<string, { recognized: number; deferred: number }>()

  for (const payment of payments) {
    const month = payment.paidAt.toISOString().slice(0, 7)
    const existing = monthlyMap.get(month) ?? { recognized: 0, deferred: 0 }
    existing.recognized += Number(payment.amount)
    monthlyMap.set(month, existing)
  }

  const byMonth = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // By customer
  const customerRevenue = new Map<string, number>()
  for (const payment of payments) {
    const invoice = invoiceMap.get(payment.invoiceId)
    if (invoice) {
      const existing = customerRevenue.get(invoice.customerId) ?? 0
      customerRevenue.set(invoice.customerId, existing + Number(payment.amount))
    }
  }

  const byCustomer = Array.from(customerRevenue.entries())
    .map(([customerId, recognized]) => ({
      customerId,
      name: customerMap.get(customerId)?.name ?? 'Unknown',
      recognized,
    }))
    .sort((a, b) => b.recognized - a.recognized)

  return {
    period: { from, to },
    recognizedRevenue,
    deferredRevenue,
    byMonth,
    byCustomer,
  }
}
