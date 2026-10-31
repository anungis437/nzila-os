import { sql } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
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
    public readonly code: 'NOTHING_DUE' | 'PROVIDER_NOT_CONFIGURED',
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

    // A member has at most one open dues payment. Every call used to insert a new full-balance payment and a new
    // intent, so repeated clicks or retries produced several payable intents for one balance, each of which could settle.
    const open = (await tx.execute(
      sql`SELECT id::text AS id, amount::text AS amount, processor_payment_id
          FROM dues_transactions
          WHERE organization_id = ${organizationId}::uuid AND member_id = ${userId} AND status = 'pending'
            AND metadata->>'kind' = ${DUES_PAYMENT_KIND}
          ORDER BY created_at DESC
          FOR UPDATE`,
    )) as unknown as { id: string; amount: string; processor_payment_id: string | null }[]
    const reusable = open.find((row) => toCents(row.amount) === toCents(balance))
    const superseded = open.filter((row) => row !== reusable)
    for (const row of superseded) {
      await tx.execute(
        sql`UPDATE dues_transactions SET status = 'cancelled', updated_at = now()
            WHERE id = ${row.id}::uuid AND status = 'pending'`,
      )
      await persistAtomicAudit(tx, {
        organizationId,
        action: 'dues.payment_cancelled',
        resourceType: 'dues_transactions',
        resourceId: row.id,
        userId,
        details: { reason: 'superseded_by_new_balance', amount: row.amount },
      })
    }
    const supersededIntents = superseded.map((row) => row.processor_payment_id)
    if (reusable) return { paymentId: reusable.id, amount: balance, supersededIntents }

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
        ...(superseded.length ? { supersededPaymentIds: superseded.map((row) => row.id) } : {}),
      },
    })
    return { paymentId, amount: balance, supersededIntents }
  })

  // An intent for a superseded payment must not stay payable: a settlement for it would be refused (its row is
  // cancelled) after the member had been charged.
  for (const intentId of pending.supersededIntents) {
    if (intentId) await input.gateway.paymentIntents.cancel?.(intentId).catch(() => undefined)
  }

  // The initiation record above says a payment was opened, not that the provider accepted it. What happens next is recorded
  // as its own state change with its own audit record: the provider intent linked, or the payment cancelled.
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
    // The provider created nothing, so the payment is cancelled and the cancellation is recorded with it. If even that cannot be
    // written the row stays pending, which is safe: the next initiation reuses an open payment of the same amount, and the
    // provider call is idempotent on the payment id. It is logged, never swallowed.
    try {
      await withRLSContext({ organizationId }, async (tx) => {
        await tx.execute(
          sql`UPDATE dues_transactions SET status = 'cancelled', updated_at = now()
              WHERE id = ${pending.paymentId}::uuid AND status = 'pending'`,
        )
        await persistAtomicAudit(tx, {
          organizationId,
          action: 'dues.payment_cancelled',
          resourceType: 'dues_transactions',
          resourceId: pending.paymentId,
          userId,
          details: { reason: 'provider_intent_not_created', amount: pending.amount },
        })
      })
    } catch (cancelError) {
      logger.error('dues_payment_cancellation_not_recorded', { paymentId: pending.paymentId, error: cancelError })
    }
    throw error
  }

  // The provider holds a payable intent from here on, so a failure to link it is not a reason to cancel the payment: that would
  // leave a chargeable intent whose settlement is refused. The row stays pending and a repeat reuses it and the same intent.
  await withRLSContext({ organizationId }, async (tx) => {
    await tx.execute(
      sql`UPDATE dues_transactions SET processor_payment_id = ${intent.id}, updated_at = now()
          WHERE id = ${pending.paymentId}::uuid AND status = 'pending'`,
    )
    await persistAtomicAudit(tx, {
      organizationId,
      action: 'dues.payment_provider_intent_linked',
      resourceType: 'dues_transactions',
      resourceId: pending.paymentId,
      userId,
      details: { paymentIntentId: intent.id, amount: pending.amount, currency: DUES_CURRENCY },
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