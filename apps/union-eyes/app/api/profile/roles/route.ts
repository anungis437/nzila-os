/**
 * GET and POST /api/profile/roles — the caller's own roles, resolved from their live membership.
 *
 * This used to be the generic CRUD collection over the `profiles` table. That table has no organization column, so the
 * tenant predicate was never applied, and any steward or higher received every user's profile on the platform (email,
 * membership tier, payment-provider and subscription identifiers, credit counters). The navbar only needs to know what
 * the signed-in user may see, so the route returns that and nothing else.
 *
 * POST is kept for the existing navbar call. Its body is ignored: a `userId` in the request names no one.
 */
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

async function ownRoles() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const roles = [...new Set(user.roles)];
  return NextResponse.json({ role: roles[0] ?? null, roles }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = ownRoles;
export const POST = ownRoles;
