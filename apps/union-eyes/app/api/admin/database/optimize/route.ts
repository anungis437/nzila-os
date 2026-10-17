/**
 * POST /api/admin/database/optimize
 * Runs ANALYZE on the database to update query planner statistics.
 */
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId } = await auth();
  if (!userId || !(await isPlatformAdminUser(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await withSystemContext(async () => {
      await db.execute(sql`ANALYZE`);
    });
    return NextResponse.json({
      success: true,
      message: 'Database ANALYZE completed — query planner statistics updated',
      optimizedAt: new Date().toISOString(),
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Optimization failed' },
      { status: 500 },
    );
  }
}
