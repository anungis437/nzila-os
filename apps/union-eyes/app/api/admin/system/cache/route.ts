/**
 * POST /api/admin/system/cache
 * Simulates cache clearing (no actual external cache in dev).
 */
import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId } = await auth();
  if (!userId || !(await isPlatformAdminUser(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    message: 'Application cache cleared',
    clearedAt: new Date().toISOString(),
  });
}
