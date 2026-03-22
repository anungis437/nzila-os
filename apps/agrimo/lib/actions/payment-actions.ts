/**
 * Agrimo Server Actions — Payments.
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
import { paymentRepo } from '@nzila/agri-db'

export async function createPayment(
  data: unknown,
): Promise<AgriServiceResult<{ paymentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = executePaymentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const payment = await paymentRepo.executePayment(dbCtx, parsed.data)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'payment',
    targetEntityId: payment.id,
    action: 'payment.created',
    label: `Created payment for producer ${parsed.data.producerId}`,
    metadata: {
      producerId: parsed.data.producerId,
      amount: parsed.data.amount,
      method: parsed.data.method,
    },
  })

  revalidatePath('/agrimo/payments')

  return { ok: true, data: { paymentId: payment.id }, error: null, auditEntries: [entry] }
}

export async function listPayments(): Promise<
  AgriServiceResult<{ payments: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await paymentRepo.listPaymentPlans({ orgId: ctx.orgId })

  return { ok: true, data: { payments: result.rows }, error: null, auditEntries: [] }
}
