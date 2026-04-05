/**
 * PUT /api/admin/users/[userId] — Toggle user status (active/inactive)
 * DELETE /api/admin/users/[userId] — Soft-delete user (set deleted_at)
 */
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';

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
    const [member] = await db
      .select({ status: organizationMembers.status })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, userId))
      .limit(1);

    const newStatus = member?.status === 'active' ? 'inactive' : 'active';

    await db
      .update(organizationMembers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(organizationMembers.id, userId));

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

