import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { toCents } from '@/lib/decimal-safe'
import { DUES_CURRENCY, DUES_PAYMENT_KIND } from './dues-payment-service'

/**
 * Dues settlement authority. Only a signature-verified Stripe webhook reaches this module, and it
 * must run inside the SYSTEM transaction. Settlement is exactly-once: the pending -> paid
 * transition is a guarded UPDATE on the internal payment row, and the ledger credit, the status
 * change and the canonical audit record commit together or not at all.
 */
export class DuesSettlementError extends Error {
  constructor(
    public readonly code:
      | 'PAYMENT_NOT_FOUND'
      | 'ORGANIZATION_MISMATCH'
      | 'MEMBER_MISMATCH'
      | 'AMOUNT_MISMATCH'
      | 'CURRENCY_MISMATCH'
      | 'PROVIDER_REFERENCE_MISMATCH'
      | 'INVALID_STATE',
    message: string,
    public readonly organizationId?: string,
    public readonly paymentId?: string,
  ) {
    super(message)
    this.name = 'DuesSettlementError'
  }
}

export interface StripePaymentIntentLike {
  id: string
  amount?: number
  amount_received?: number
  currency?: string
  metadata?: Record<string, string> | null
}

export function isDuesPaymentIntent(pi: StripePaymentIntentLike | null | undefined): boolean {
  return pi?.metadata?.ue_payment_kind === DUES_PAYMENT_KIND
}

interface PaymentRow {
  id: string
  organization_id: string
  member_id: string
  amount: string
  status: string
  processor_payment_id: string | null
}

async function lockPayment(tx: RLSTx, pi: StripePaymentIntentLike): Promise<PaymentRow> {
  const paymentId = pi.metadata?.ue_dues_payment_id ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(paymentId))
    throw new DuesSettlementError('PAYMENT_NOT_FOUND', 'Missing internal dues payment reference')
  const rows = (await tx.execute(
    sql`SELECT id::text AS id, organization_id::text AS organization_id, member_id, amount::text AS amount,
               status, processor_payment_id
        FROM dues_transactions WHERE id = ${paymentId}::uuid FOR UPDATE`,
  )) as unknown as PaymentRow[]
  if (!rows[0]) throw new DuesSettlementError('PAYMENT_NOT_FOUND', 'Unknown dues payment reference')
  const row = rows[0]
  const meta = pi.metadata ?? {}
  if (meta.organization_id !== row.organization_id)
    throw new DuesSettlementError(
      'ORGANIZATION_MISMATCH',
      'Organization metadata mismatch',
      row.organization_id,
      row.id,
    )
  if (meta.member_user_id !== row.member_id)
    throw new DuesSettlementError(
      'MEMBER_MISMATCH',
      'Member metadata mismatch',
      row.organization_id,
      row.id,
    )
  if ((pi.currency ?? '').toLowerCase() !== DUES_CURRENCY)
    throw new DuesSettlementError(
      'CURRENCY_MISMATCH',
      'Currency mismatch',
      row.organization_id,
      row.id,
    )
  const received = pi.amount_received ?? pi.amount ?? -1
  if (received !== toCents(row.amount))
    throw new DuesSettlementError('AMOUNT_MISMATCH', 'Amount mismatch', row.organization_id, row.id)
  if (row.processor_payment_id !== pi.id)
    throw new DuesSettlementError(
      'PROVIDER_REFERENCE_MISMATCH',
      'Payment intent mismatch',
      row.organization_id,
      row.id,
    )
  return row
}

export async function settleDuesPaymentIntent(
  tx: RLSTx,
  pi: StripePaymentIntentLike,
  eventId: string,
): Promise<'settled' | 'duplicate'> {
  const row = await lockPayment(tx, pi)
  if (row.status === 'paid') return 'duplicate'
  if (row.status !== 'pending')
    throw new DuesSettlementError(
      'INVALID_STATE',
      `Dues payment is ${row.status}`,
      row.organization_id,
      row.id,
    )

  const settled = (await tx.execute(
    sql`UPDATE dues_transactions
        SET status = 'paid', payment_date = now(), paid_date = now(), payment_reference = ${pi.id},
            updated_at = now()
        WHERE id = ${row.id}::uuid AND status = 'pending'
        RETURNING id::text AS id`,
  )) as unknown as { id: string }[]
  if (!settled[0]) return 'duplicate'

  const balance = (await tx.execute(
    sql`SELECT COALESCE(
          SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END) -
          SUM(CASE WHEN transaction_type IN ('payment','credit','adjustment','write_off') THEN amount ELSE 0 END),
          0)::text AS balance
        FROM member_dues_ledger
        WHERE organization_id = ${row.organization_id}::uuid AND user_id = ${row.member_id} AND status = 'posted'`,
  )) as unknown as { balance: string }[]
  const before = balance[0]?.balance ?? '0'
  const ledger = (await tx.execute(
    sql`INSERT INTO member_dues_ledger
          (user_id, organization_id, transaction_type, transaction_date, effective_date, amount,
           balance_before, balance_after, payment_method, payment_reference, reference_type, reference_id,
           description, status, created_by, metadata)
        VALUES (${row.member_id}, ${row.organization_id}::uuid, 'payment', now(), now(), ${row.amount}::numeric,
           ${before}::numeric, (${before}::numeric - ${row.amount}::numeric), 'stripe', ${pi.id},
           'dues_transaction', ${row.id}::uuid, 'Dues payment settled by verified Stripe event', 'posted',
           'system:stripe-webhook', ${JSON.stringify({ stripeEventId: eventId, paymentIntentId: pi.id })}::jsonb)
        RETURNING id::text AS id`,
  )) as unknown as { id: string }[]

  await appendMandatoryAudit(tx, {
    organizationId: row.organization_id,
    action: 'dues.settle',
    resourceType: 'dues_transactions',
    resourceId: row.id,
    userId: 'system:stripe-webhook',
    details: {
      memberUserId: row.member_id,
      amount: row.amount,
      currency: DUES_CURRENCY,
      paymentIntentId: pi.id,
      stripeEventId: eventId,
      ledgerEntryId: ledger[0]?.id,
    },
  })
  return 'settled'
}

/** Provider failure/cancellation of a pending dues payment; never credits the ledger. */
export async function recordDuesPaymentProviderOutcome(
  tx: RLSTx,
  pi: StripePaymentIntentLike,
  eventId: string,
  status: 'failed' | 'cancelled',
): Promise<'recorded' | 'ignored'> {
  const row = await lockPayment(tx, { ...pi, amount: pi.amount ?? undefined })
  if (row.status !== 'pending') return 'ignored'
  await tx.execute(
    sql`UPDATE dues_transactions SET status = ${status}, updated_at = now()
        WHERE id = ${row.id}::uuid AND status = 'pending'`,
  )
  await appendMandatoryAudit(tx, {
    organizationId: row.organization_id,
    action: `dues.payment_${status}`,
    resourceType: 'dues_transactions',
    resourceId: row.id,
    userId: 'system:stripe-webhook',
    details: { paymentIntentId: pi.id, stripeEventId: eventId },
  })
  return 'recorded'
}

export async function recordDuesSettlementDenial(
  tx: RLSTx,
  error: DuesSettlementError,
  eventId: string,
): Promise<void> {
  if (!error.organizationId) return
  await appendMandatoryAudit(tx, {
    organizationId: error.organizationId,
    action: 'dues.settlement_denied',
    resourceType: 'dues_transactions',
    resourceId: error.paymentId ?? null,
    userId: 'system:stripe-webhook',
    details: { reason: error.code, stripeEventId: eventId },
  })
}
