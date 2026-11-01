/**
 * End-to-end auth-gate test
 *
 * 1. Verifies auth session is present
 * 2. Calls Django GET /api/auth_core/health/  (public)
 * 3. Calls Django GET /api/auth_core/me/      (requires auth JWT)
 *
 * Returns a single JSON object so the full round-trip can be confirmed in one
 * request. `passed: true` means the Django auth gate is closed end-to-end.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { isPlatformAdminUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

const DJANGO = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function GET(_req: NextRequest) {
  // ── Step 1: Auth session ──────────────────────────────────────────────────────────
  const { userId, orgId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json(
      { passed: false, message: 'No auth session — sign in first' },
      { status: 401 }
    );
  }

  // This route forwards the caller's session token to the backend, so it is a platform operator's diagnostic. It answers statuses only: the
  // backend's response bodies are not returned to a signed-in user of any organization.
  if (!(await isPlatformAdminUser(userId))) {
    return NextResponse.json({ passed: false, message: 'Platform administrator required' }, { status: 403 });
  }

  const token = await getToken();

  // ── Step 2: Django health (no auth) ────────────────────────────────────────
  let healthStatus = 0;
  try {
    const r = await fetch(`${DJANGO}/api/auth_core/health/`, { cache: 'no-store' });
    healthStatus = r.status;
  } catch {
    healthStatus = 0;
  }

  // ── Step 3: Django /me/ (JWT required) ─────────────────────────────────────
  let meStatus = 0;
  try {
    const r = await fetch(`${DJANGO}/api/auth_core/me/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    meStatus = r.status;
  } catch {
    meStatus = 0;
  }

  return NextResponse.json({
    passed: meStatus === 200,
    session: {
      userId,
      orgId: orgId ?? null,
      hasToken: !!token,
    },
    django: {
      health: { status: healthStatus },
      me: { status: meStatus },
    },
  });
}


