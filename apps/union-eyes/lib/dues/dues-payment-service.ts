import { sql } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { recordExternalDisclosure } from '@/lib/audit/external-disclosure'
import { fromCents, toCents } from '@/lib/decimal-safe'
import { logger } from '@/lib/logger'

/**
 * Member dues payment initiation. The server owns everything that matters: the amount is the
 * member's outstanding ledger balance, the organization and member come from the canonical
 * session, and the provider metadata is bound to an immutable internal payment reference.
 * Nothing here credits the ledger; only a verified Stripe webhook may settle (see dues-settlement).
 */
export const DUES_PAYMENT_KIND = 'member_dues'
export const DUES_CURRENCY = 'cad'

export class DuesInitiationError extends Error {
  constructor(
    public readonly code: 'NOTHING_DUE' | 'PROVIDER_NOT_CONFIGURED' | 'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
    message: string,
  ) {
    super(message)
    this.name = 'DuesInitiationError'
  }
}

export type DuesPaymentInitiation = {
  paymentId: string
  paymentIntentId: string
  clientSecret: string | null
  amount: string
  currency: string
}

export async function outstandingDuesBalance(
  tx: RLSTx,
  organizationId: string,
  userId: string,
): Promise<string> {
  const rows = (await tx.execute(
    sql`SELECT COALESCE(
          SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END) -
          SUM(CASE WHEN transaction_type IN ('payment','credit','adjustment','write_off') THEN amount ELSE 0 END),
          0)::text AS balance
        FROM member_dues_ledger
        WHERE organization_id = ${organizationId}::uuid AND user_id = ${userId} AND status = 'posted'`,
  )) as unknown as { balance: string }[]
  return rows[0]?.balance ?? '0'
}

type StripeFacade = {
  paymentIntents: {
    create(
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<{ id: string; client_secret: string | null }>
    cancel?(id: string): Promise<unknown>
    retrieve?(id: string): Promise<{
      id: string
      client_secret: string | null
      amount: number
      currency: string
      metadata: Record<string, string> | null
      status: string
    }>
  }
}

export async function initiateDuesPayment(input: {
  organizationId: string
  userId: string
  gateway: StripeFacade
  providerConfigured: boolean
}): Promise<DuesPaymentInitiation> {
  if (!input.providerConfigured)
    throw new DuesInitiationError('PROVIDER_NOT_CONFIGURED', 'Payment provider is not configured')
  const { organizationId, userId } = input

  const pending = await withRLSContext({ organizationId }, async (tx) => {
    // One initiation per member at a time: concurrent or repeated calls queue here, so they see each other's rows.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${userId}:member_dues`}, 0))`,
    )
    const balance = await outstandingDuesBalance(tx, organizationId, userId)
    if (toCents(balance) <= 0)
      throw new DuesInitiationError('NOTHING_DUE', 'No dues are outstanding')

    // Do not cancel a chargeable external intent when the balance changes.
    // Cancellation cannot be rolled back with this database transaction.
    const open = (await tx.execute(
      sql`SELECT id::text AS id, amount::text AS amount, processor_payment_id,
                 (created_at > now() - interval '12 hours') AS within_retry_window
          FROM dues_transactions
          WHERE organization_id = ${organizationId}::uuid AND member_id = ${userId} AND status = 'pending'
            AND metadata->>'kind' = ${DUES_PAYMENT_KIND}
          ORDER BY created_at DESC
          FOR UPDATE`,
    )) as unknown as {
      id: string
      amount: string
      processor_payment_id: string | null
      within_retry_window: boolean
    }[]
    if (open.length > 1 || (open[0] && toCents(open[0].amount) !== toCents(balance))) {
      throw new DuesInitiationError(
        'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
        'An existing dues payment must be reconciled before a new payment can be initiated',
      )
    }
    // An unlinked provider request may have succeeded despite a transport timeout.
    // Retry the same idempotency key only within a conservative bounded window.
    if (open[0] && !open[0].processor_payment_id && !open[0].within_retry_window) {
      throw new DuesInitiationError(
        'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
        'The unconfirmed payment is too old to retry without provider reconciliation',
      )
    }
    if (open[0]) {
      return { paymentId: open[0].id, amount: balance, providerIntentId: open[0].processor_payment_id }
    }

    const created = (await tx.execute(
      sql`INSERT INTO dues_transactions
            (organization_id, member_id, transaction_type, amount, period_start, period_end, due_date,
             status, processor_type, dues_amount, total_amount, metadata)
          VALUES (${organizationId}::uuid, ${userId}, 'payment', ${balance}::numeric, CURRENT_DATE, CURRENT_DATE,
             CURRENT_DATE, 'pending', 'stripe', ${balance}::numeric, ${balance}::numeric,
             ${JSON.stringify({ kind: DUES_PAYMENT_KIND, source: 'outstanding_balance' })}::jsonb)
          RETURNING id::text AS id`,
    )) as unknown as { id: string }[]
    const paymentId = created[0].id
    await persistAtomicAudit(tx, {
      organizationId,
      action: 'dues.payment_initiated',
      resourceType: 'dues_transactions',
      resourceId: paymentId,
      userId,
      details: {
        amount: balance,
        currency: DUES_CURRENCY,
      },
    })
    return { paymentId, amount: balance, providerIntentId: null }
  })

  // Reuse an already linked provider intent instead of creating another:
  // provider idempotency retention is finite. Verify amount, identity and status.
  if (pending.providerIntentId) {
    if (!input.gateway.paymentIntents.retrieve) {
      throw new DuesInitiationError(
        'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
        'The existing payment intent cannot be verified for reuse',
      )
    }
    const existing = await input.gateway.paymentIntents.retrieve(pending.providerIntentId)
    const metadata = existing.metadata ?? {}
    const actionable = ['requires_payment_method', 'requires_confirmation', 'requires_action']
    if (
      existing.id !== pending.providerIntentId ||
      existing.amount !== toCents(pending.amount) ||
      existing.currency?.toLowerCase() !== DUES_CURRENCY ||
      metadata.ue_payment_kind !== DUES_PAYMENT_KIND ||
      metadata.ue_dues_payment_id !== pending.paymentId ||
      metadata.organization_id !== organizationId ||
      metadata.member_user_id !== userId ||
      !actionable.includes(existing.status)
    ) {
      throw new DuesInitiationError(
        'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
        'The existing payment intent is not safe to reuse',
      )
    }
    return {
      paymentId: pending.paymentId,
      paymentIntentId: existing.id,
      clientSecret: existing.client_secret,
      amount: fromCents(toCents(pending.amount)),
      currency: DUES_CURRENCY,
    }
  }

  // Opening the internal payment does not mean the provider accepted an intent.
  // A successful link is audited; an ambiguous provider error preserves the pending row.
  let intent: { id: string; client_secret: string | null }
  try {
    intent = await input.gateway.paymentIntents.create(
      {
        amount: toCents(pending.amount),
        currency: DUES_CURRENCY,
        automatic_payment_methods: { enabled: true },
        description: `Union dues ${pending.paymentId}`,
        metadata: {
          ue_payment_kind: DUES_PAYMENT_KIND,
          ue_dues_payment_id: pending.paymentId,
          organization_id: organizationId,
          member_user_id: userId,
        },
      },
      { idempotencyKey: `ue-dues-${pending.paymentId}` },
    )
  } catch (error) {
    // A transport error does not prove the provider created nothing. Preserve
    // the pending reference and retry its idempotency key within the safe window.
    logger.error('dues_payment_intent_creation_unconfirmed', { paymentId: pending.paymentId, error })
    throw error
  }

  // The provider holds a payable intent from here on, so a failure to link it is not a reason to cancel the payment: that would
  // leave a chargeable intent whose settlement is refused. The row stays pending and a repeat reuses it and the same intent.
  await withRLSContext({ organizationId }, async (tx) => {
    const linked = (await tx.execute(
      sql`UPDATE dues_transactions SET processor_payment_id = ${intent.id}, updated_at = now()
          WHERE id = ${pending.paymentId}::uuid AND status = 'pending'
            AND (processor_payment_id IS NULL OR processor_payment_id = ${intent.id})
          RETURNING id::text AS id`,
    )) as unknown as { id: string }[]
    if (!linked[0]) {
      throw new DuesInitiationError(
        'PENDING_PAYMENT_REQUIRES_RECONCILIATION',
        'The payment intent could not be linked to an unchanged pending payment',
      )
    }
    await persistAtomicAudit(tx, {
      organizationId,
      action: 'dues.payment_provider_intent_linked',
      resourceType: 'dues_transactions',
      resourceId: pending.paymentId,
      userId,
      details: { paymentIntentId: intent.id, amount: pending.amount, currency: DUES_CURRENCY },
    })
    // The platform-managed Stripe client (lib/stripe), not a per-organization processor account,
    // receives the organization and member identifiers below — see this file's module doc comment.
    await recordExternalDisclosure(tx, {
      organizationId,
      userId,
      processor: 'stripe',
      resourceType: 'dues_transactions',
      resourceId: pending.paymentId,
      dataClasses: ['organization_id', 'member_user_id'],
      purpose: 'Union dues payment processing (PaymentIntent metadata)',
      merchantOfRecord: 'platform',
    })
  })
  return {
    paymentId: pending.paymentId,
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    amount: fromCents(toCents(pending.amount)),
    currency: DUES_CURRENCY,
  }
}