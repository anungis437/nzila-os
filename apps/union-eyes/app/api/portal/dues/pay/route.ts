/**
 * GET  /api/portal/dues/pay  — member's payment history (recent)
 * POST /api/portal/dues/pay  — record a dues payment
 *
 * Records dues payments against the member_dues_ledger.
 * For Stripe payments, the actual charge flow goes through the payment
 * processor / Stripe webhook; this endpoint records the ledger entry
 * and links to the external payment reference.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createLogger } from '@nzila/os-core'

const logger = createLogger('portal:dues:pay')

export const dynamic = 'force-dynamic';

// ── GET: recent payment history ───────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = req.nextUrl.searchParams.get('organizationId')
      || req.headers.get('x-organization-id');
    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing organizationId' },
        { status: 400 },
      );
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100);

    const payments = await db
      .select({
        id: memberDuesLedger.id,
        type: memberDuesLedger.transactionType,
        amount: memberDuesLedger.amount,
        balanceAfter: memberDuesLedger.balanceAfter,
        date: memberDuesLedger.transactionDate,
        description: memberDuesLedger.description,
        paymentMethod: memberDuesLedger.paymentMethod,
        paymentReference: memberDuesLedger.paymentReference,
        receiptNumber: memberDuesLedger.receiptNumber,
        status: memberDuesLedger.status,
      })
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.userId, userId),
          eq(memberDuesLedger.organizationId, orgId),
        ),
      )
      .orderBy(desc(memberDuesLedger.transactionDate))
      .limit(limit);

    return NextResponse.json({ success: true, data: { payments } });
  } catch (error) {
    logger.error('[portal/dues/pay] GET Error:', error instanceof Error ? error : { detail: error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment history' },
      { status: 500 },
    );
  }
}

// ── POST: record a dues payment ──────────────────────────────────
const paymentSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum([
    'stripe',
    'bank_transfer',
    'check',
    'cash',
    'direct_debit',
    'payroll_deduction',
    'ewallet',
  ]),
  paymentReference: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { organizationId, amount, paymentMethod, paymentReference, description } = parsed.data;

    // Compute current balance before this payment
    const [current] = await db
      .select({
        balance: sql<string>`COALESCE(
          SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'charge' THEN ${memberDuesLedger.amount} ELSE 0 END) -
          SUM(CASE WHEN ${memberDuesLedger.transactionType} IN ('payment','credit','adjustment','write_off') THEN ${memberDuesLedger.amount} ELSE 0 END),
          0
        )`,
      })
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.userId, userId),
          eq(memberDuesLedger.organizationId, organizationId),
          eq(memberDuesLedger.status, 'posted'),
        ),
      );

    const balanceBefore = parseFloat(current?.balance ?? '0');
    const balanceAfter = balanceBefore - amount;

    // Insert ledger entry
    const [entry] = await db
      .insert(memberDuesLedger)
      .values({
        userId,
        organizationId,
        transactionType: 'payment',
        transactionDate: new Date(),
        effectiveDate: new Date(),
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        paymentMethod,
        paymentReference: paymentReference ?? null,
        description: description ?? `Dues payment via ${paymentMethod}`,
        status: 'posted',
        createdBy: userId,
      })
      .returning({ id: memberDuesLedger.id });

    return NextResponse.json({
      success: true,
      data: {
        ledgerEntryId: entry.id,
        amountPaid: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
      },
    });
  } catch (error) {
    logger.error('[portal/dues/pay] POST Error:', error instanceof Error ? error : { detail: error });
    return NextResponse.json(
      { success: false, error: 'Failed to record payment' },
      { status: 500 },
    );
  }
}

