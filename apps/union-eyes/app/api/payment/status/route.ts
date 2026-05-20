import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { getProfileByUserId } from '@/db/queries/profiles-queries';

/**
 * GET /api/payment/status
 * Returns whether the current user's payment has failed.
 * Uses a plain GET route (not a server action) to avoid triggering
 * the automatic RSC page refresh that server actions cause.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ paymentFailed: false });
    }

    const profile = await getProfileByUserId(userId);
    return NextResponse.json({
      paymentFailed: profile?.status === 'payment_failed' || false,
    });
  } catch {
    return NextResponse.json({ paymentFailed: false });
  }
}
