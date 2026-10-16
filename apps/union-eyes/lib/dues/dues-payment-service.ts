import { sql } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { fromCents, toCents } from '@/lib/decimal-safe'

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
  }
}

export async function initiateDuesPayment(input: {
  organizationId: string
  userId: string
  stripe: StripeFacade
  providerConfigured: boolean
}): Promise<DuesPaymentInitiation> {
  if (!input.providerConfigured)
    throw new DuesInitiationError('PROVIDER_NOT_CONFIGURED', 'Payment provider is not configured')
  const { organizationId, userId } = input

  const pending = await withRLSContext({ organizationId }, async (tx) => {
    const balance = await outstandingDuesBalance(tx, organizationId, userId)
    if (toCents(balance) <= 0)
      throw new DuesInitiationError('NOTHING_DUE', 'No dues are outstanding')
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
    await appendMandatoryAudit(tx, {
      organizationId,
      action: 'dues.payment_initiated',
      resourceType: 'dues_transactions',
      resourceId: paymentId,
      userId,
      details: { amount: balance, currency: DUES_CURRENCY },
    })
    return { paymentId, amount: balance }
  })

  try {
    const intent = await input.stripe.paymentIntents.create(
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
    await withRLSContext({ organizationId }, async (tx) => {
      await tx.execute(
        sql`UPDATE dues_transactions SET processor_payment_id = ${intent.id}, updated_at = now()
            WHERE id = ${pending.paymentId}::uuid AND status = 'pending'`,
      )
    })
    return {
      paymentId: pending.paymentId,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount: fromCents(toCents(pending.amount)),
      currency: DUES_CURRENCY,
    }
  } catch (error) {
    await withRLSContext({ organizationId }, async (tx) => {
      await tx.execute(
        sql`UPDATE dues_transactions SET status = 'cancelled', updated_at = now()
            WHERE id = ${pending.paymentId}::uuid AND status = 'pending'`,
      )
    }).catch(() => undefined)
    throw error
  }
}
