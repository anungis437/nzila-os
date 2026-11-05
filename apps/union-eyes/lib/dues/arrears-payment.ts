import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { memberArrears, memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { amountToMinor, FinancialDutyError, performFinancialDuty } from '@/lib/authority/store/finance-route-adapter';

/** The dues ledger carries no currency column: it is a CAD ledger, so only a CAD payment may be posted to it. */
export const ARREARS_LEDGER_CURRENCY = 'CAD';

export interface ArrearsPaymentInput {
  userId: string;
  organizationId: string;
  /** The member whose arrears the payment settles (`member_arrears.user_id`). */
  memberId: string;
  /** The registered `public.payments` transaction being executed. */
  paymentId: string;
  /** The amount the caller claims; it must equal the amount on the transaction's record. */
  amount: number;
  notes?: string;
}

const minorOf = (value: string | null | undefined): number => Math.round(parseFloat(value ?? '0') * 100);
const decimalOf = (minor: number): string => (minor / 100).toFixed(2);

/**
 * Posting a received payment to a member's dues ledger is the `execute` duty of that payment: the money is applied.
 * It needs a transaction that was prepared and approved by others and is executed by a third, independent person (the
 * kernel enforces this against the transaction's real participants). The kernel decision, the financial step, the
 * ledger entry, the arrears update and the audit record commit together or not at all.
 */
export async function recordArrearsPayment(tx: RLSTx, input: ArrearsPaymentInput) {
  const amountMinor = amountToMinor(input.amount);
  const { result } = await performFinancialDuty(
    tx,
    {
      userId: input.userId,
      organizationId: input.organizationId,
      transactionId: input.paymentId,
      step: 'executed',
      amountMinor,
      currency: ARREARS_LEDGER_CURRENCY,
    },
    async () => {
      const [arrears] = await tx
        .select()
        .from(memberArrears)
        .where(and(eq(memberArrears.userId, input.memberId), eq(memberArrears.organizationId, input.organizationId)))
        .for('update');
      if (!arrears) throw ApiError.notFound('Arrears record not found');

      // The payer recorded on the transaction must be the member whose arrears are being settled.
      const payer = (await tx.execute(
        sql`SELECT member_id FROM public.payments WHERE organization_id = ${input.organizationId}::uuid AND id = ${input.paymentId}::uuid`,
      )) as unknown;
      const payerRows = (Array.isArray(payer) ? payer : ((payer as { rows?: unknown[] }).rows ?? [])) as Array<{ member_id?: string | null }>;
      if (payerRows[0]?.member_id !== input.memberId) {
        throw new FinancialDutyError('FACT_MISMATCH', 'The payer on the transaction is not the member whose arrears are being settled.');
      }

      const before = minorOf(arrears.totalOwed);
      const after = Math.max(0, before - amountMinor);
      const now = new Date();
      await tx.insert(memberDuesLedger).values({
        userId: input.memberId,
        organizationId: input.organizationId,
        transactionType: 'payment',
        transactionDate: now,
        effectiveDate: now,
        amount: decimalOf(amountMinor),
        balanceBefore: decimalOf(before),
        balanceAfter: decimalOf(after),
        referenceType: 'payment',
        referenceId: input.paymentId,
        description: input.notes ?? 'Arrears payment',
        notes: input.notes,
        paymentMethod: 'manual',
        createdBy: input.userId,
      });
      const [updated] = await tx
        .update(memberArrears)
        .set({
          totalOwed: decimalOf(after),
          lastPaymentDate: now,
          arrearsStatus: after === 0 ? 'current' : arrears.arrearsStatus,
          updatedAt: now,
        })
        .where(and(eq(memberArrears.id, arrears.id), eq(memberArrears.organizationId, input.organizationId)))
        .returning();

      return {
        result: { balanceAfter: after / 100, arrears: updated },
        audit: {
          action: 'dues.arrears.payment_record',
          resourceType: 'member_arrears',
          resourceId: arrears.id,
          details: { memberId: input.memberId, amount: amountMinor / 100, balanceBefore: before / 100, balanceAfter: after / 100, paymentId: input.paymentId },
        },
      };
    },
  );
  return result;
}
