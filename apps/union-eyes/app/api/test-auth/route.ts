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

  const token = await getToken();

  // ── Step 2: Django health (no auth) ────────────────────────────────────────
  let healthStatus = 0;
  let healthBody: unknown = null;
  try {
    const r = await fetch(`${DJANGO}/api/auth_core/health/`, { cache: 'no-store' });
    healthStatus = r.status;
    healthBody = await r.json();
  } catch (e) {
    healthBody = { error: String(e) };
  }

  // ── Step 3: Django /me/ (JWT required) ─────────────────────────────────────
  let meStatus = 0;
  let meBody: unknown = null;
  try {
    const r = await fetch(`${DJANGO}/api/auth_core/me/`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    meStatus = r.status;
    meBody = await r.json();
  } catch (e) {
    meBody = { error: String(e) };
  }

  return NextResponse.json({
    passed: meStatus === 200,
    session: {
      userId,
      orgId: orgId ?? null,
      hasToken: !!token,
    },
    django: {
      health: { status: healthStatus, body: healthBody },
      me: { status: meStatus, body: meBody },
    },
  });
}


