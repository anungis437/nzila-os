/**
 * POST /api/admin/system/cache
 *
 * Retired: the application has no cache this route could clear, and it used to answer "Application cache cleared"
 * regardless. Platform administrators are still told the truth; everyone else is refused. No operation is performed.
 */
import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';
import { retiredHandler } from '@/lib/api/retired-route';

export const dynamic = 'force-dynamic';

const retired = retiredHandler('the cache controls of the deployment platform');

export async function POST() {
  const { userId } = await auth();
  if (!userId || !(await isPlatformAdminUser(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return retired();
}
