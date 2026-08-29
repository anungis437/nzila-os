/**
 * PUT /api/admin/users/[userId] — Toggle user status (active/inactive)
 * DELETE /api/admin/users/[userId] — Soft-delete user (set deleted_at)
 * 
 * Phase 2 Domain 5: Member status enforcement + event-driven access revocation
 */
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

type Params = { params: Promise<{ userId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { userId: authUserId } = await auth();
  if (!authUserId || !isPlatformAdmin(authUserId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;

  try {
    // Find current status and toggle
    const [memberRecord] = await db
      .select({ status: organizationMembers.status, organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, userId))
      .limit(1);

    if (!memberRecord) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const newStatus = memberRecord.status === 'active' ? 'inactive' : 'active';
    const oldStatus = memberRecord.status;

    // Update member status
    await db
      .update(organizationMembers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(organizationMembers.id, userId));

    // Phase 2 Domain 5: Emit member.status_changed event to trigger access revocation
    // This enables event-driven enforcement of member lifecycle (sessions, case access)
    try {
      // Dynamic import to avoid circular dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { eventBus } = await import('@/lib/events/event-bus');
      
      await eventBus.emitAndWait('member.status_changed', {
        userId,
        organizationId: memberRecord.organizationId,
        oldStatus,
        newStatus,
        timestamp: new Date(),
      });
    } catch (_eventError) {
      // Log event emission failure but don't block the response
      // (status update is durable; event emission is async enhancement)
      logger.error('member_lifecycle:event_emission_failed', { userId });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch {
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId: authUserId } = await auth();
  if (!authUserId || !isPlatformAdmin(authUserId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await params;

  try {
    // Soft delete
    await db
      .update(organizationMembers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(organizationMembers.id, userId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

