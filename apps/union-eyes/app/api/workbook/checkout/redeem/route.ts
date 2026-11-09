import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { workbookCheckoutIntents } from '@/db/schema/workbook-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  hashWorkbookCheckoutReference,
  workbookCheckoutReferenceIsPlausible,
} from '@/lib/workbook/checkout-intent';
import { guardPublicIntake } from '@/lib/public-intake/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({ ref: z.string() });

export async function POST(request: NextRequest) {
  const intake = await guardPublicIntake(request, { bucket: 'checkout', challenge: false });
  if (!intake.ok) return intake.response;
  const parsed = bodySchema.safeParse(intake.json);
  if (!parsed.success || !workbookCheckoutReferenceIsPlausible(parsed.data.ref)) {
    return NextResponse.json({ error: 'Invalid checkout reference' }, { status: 422 });
  }

  const [redeemed] = await withSystemContext((tx) =>
    tx
      .update(workbookCheckoutIntents)
      .set({ status: 'redeemed', redeemedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(workbookCheckoutIntents.publicRefHash, hashWorkbookCheckoutReference(parsed.data.ref)),
        eq(workbookCheckoutIntents.status, 'fulfilled'),
        gt(workbookCheckoutIntents.expiresAt, new Date()),
        isNull(workbookCheckoutIntents.redeemedAt),
      ))
      .returning({ workbookId: workbookCheckoutIntents.workbookId }),
  );

  if (!redeemed) {
    return NextResponse.json({ error: 'Checkout is not redeemable' }, { status: 409 });
  }
  return NextResponse.json({ workbookId: redeemed.workbookId });
}
