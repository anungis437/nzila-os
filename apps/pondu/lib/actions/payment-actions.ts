/**
 * Pondu Server Actions — Payments.
 *
 * Create payment distribution plans and disburse to producers.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  executePaymentSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'

export async function createPayment(
  data: unknown,
): Promise<AgriServiceResult<{ paymentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = executePaymentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'payment',
    targetEntityId: id,
    action: 'payment.created',
    label: `Created payment for producer ${parsed.data.producerId}`,
    metadata: {
      producerId: parsed.data.producerId,
      amount: parsed.data.amount,
      method: parsed.data.method,
    },
  })

  // TODO: persist via agri-db PaymentRepository

  revalidatePath('/pondu/payments')

  return { ok: true, data: { paymentId: id }, error: null, auditEntries: [entry] }
}

export async function listPayments(): Promise<
  AgriServiceResult<{ payments: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db PaymentRepository scoped to ctx.orgId

  return { ok: true, data: { payments: [] }, error: null, auditEntries: [] }
}
