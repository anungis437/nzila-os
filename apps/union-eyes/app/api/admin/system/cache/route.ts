/**
 * POST /api/admin/system/cache
 * Simulates cache clearing (no actual external cache in dev).
 */
import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';

export const dynamic = 'force-dynamic';

function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

export async function POST() {
  const { userId } = await auth();
  if (!userId || !isPlatformAdmin(userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    message: 'Application cache cleared',
    clearedAt: new Date().toISOString(),
  });
}

