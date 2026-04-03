'use server'

import { getReadContext } from '@/lib/clerk-org-resolver'
import { db, commercePayments, commerceInvoices, commerceCustomers } from '@nzila/db'
import { eq, desc, and } from 'drizzle-orm'
import { executeCommand } from '@/lib/control/control-adapter'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export async function getPaymentsAction(opts?: { limit?: number; offset?: number }) {
  const ctx = await getReadContext()
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  const rows = await db
    .select({
      id: commercePayments.id,
      invoiceId: commercePayments.invoiceId,
      amount: commercePayments.amount,
      method: commercePayments.method,
      reference: commercePayments.reference,
      paidAt: commercePayments.paidAt,
      invoiceRef: commerceInvoices.ref,
      customerId: commerceInvoices.customerId,
      customerName: commerceCustomers.name,
    })
    .from(commercePayments)
    .innerJoin(commerceInvoices, eq(commercePayments.invoiceId, commerceInvoices.id))
    .leftJoin(commerceCustomers, eq(commerceInvoices.customerId, commerceCustomers.id))
    .where(eq(commercePayments.orgId, ctx.orgId))
    .orderBy(desc(commercePayments.paidAt))
    .limit(limit)
    .offset(offset)

  // RSC cannot serialize `undefined` — coerce to null
  const safe = rows.map((r) => ({
    ...r,
    reference: r.reference ?? null,
    paidAt: r.paidAt ?? null,
    invoiceRef: r.invoiceRef ?? null,
    customerName: r.customerName ?? null,
  }))

  return { rows: safe }
}

export async function recordPaymentAction(data: {
  invoiceId: string
  amount: number
  method: string
  reference?: string
}) {
  // Verify invoice belongs to this org
  const ctx = await getReadContext()
  const [invoice] = await db
    .select()
    .from(commerceInvoices)
    .where(and(eq(commerceInvoices.id, data.invoiceId), eq(commerceInvoices.orgId, ctx.orgId)))
    .limit(1)

  if (!invoice) throw new Error('Invoice not found')
  if (!invoice.orderId) throw new Error('Invoice is not linked to an order')

  const result = await executeCommand({
    type: 'record_payment',
    order_id: invoice.orderId,
    amount: data.amount,
    currency: 'CAD' as const,
    method: (data.method.toUpperCase() || 'OTHER') as 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'OTHER',
    reference: data.reference,
    actor_id: '',
  })

  if (!result.ok) throw new Error(result.error ?? 'Payment recording failed')
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PAYMENT_RECORDED', orgId: ctx.orgId, actorId: ctx.orgId, metadata: { invoiceId: data.invoiceId, amount: data.amount } }))
  return result.data
}
