/**
 * Provider-bound OAuth CSRF state. No user identifier is sent as a bare state.
 * The signed state is bound to a short-lived HttpOnly cookie and to the
 * authenticated user, active organization and provider at callback time.
 * Missing signing configuration fails closed, including in development.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export type CalendarOAuthProvider = 'google' | 'microsoft';
const TTL_MS = 10 * 60 * 1000;

function signingKey(): Buffer {
  const value = process.env.CALENDAR_OAUTH_STATE_SECRET || process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('Calendar OAuth state signing key is not configured');
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'utf8');
  if (key.length < 32) throw new Error('Calendar OAuth state signing key must be at least 32 bytes');
  return key;
}

function cookieName(provider: CalendarOAuthProvider): string {
  return `ue_calendar_oauth_${provider}`;
}

export function issueCalendarOAuthState(
  provider: CalendarOAuthProvider,
  userId: string,
  organizationId: string,
  now = Date.now(),
): string {
  if (!userId || !organizationId) throw new Error('Calendar OAuth requires user and organization');
  const payload = Buffer.from(JSON.stringify({
    provider, userId, organizationId, issuedAt: now, nonce: randomBytes(32).toString('base64url'),
  })).toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function setCalendarOAuthStateCookie(
  response: NextResponse,
  provider: CalendarOAuthProvider,
  state: string,
): void {
  response.cookies.set(cookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/api/calendar-sync/${provider}/callback`,
    maxAge: TTL_MS / 1000,
  });
}

export function clearCalendarOAuthStateCookie(response: NextResponse, provider: CalendarOAuthProvider): void {
  response.cookies.set(cookieName(provider), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/api/calendar-sync/${provider}/callback`,
    maxAge: 0,
  });
}

export function verifyCalendarOAuthState(
  request: NextRequest,
  provider: CalendarOAuthProvider,
  state: string | null,
  userId: string,
  organizationId: string,
  now = Date.now(),
): boolean {
  if (!state || state.length > 2048 || !userId || !organizationId) return false;
  const cookie = request.cookies.get(cookieName(provider))?.value;
  if (!cookie || cookie.length !== state.length) return false;
  const cookieBytes = Buffer.from(cookie);
  const stateBytes = Buffer.from(state);
  if (cookieBytes.length !== stateBytes.length || !timingSafeEqual(cookieBytes, stateBytes)) return false;
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = createHmac('sha256', signingKey()).update(parts[0]).digest('base64url');
  const suppliedBytes = Buffer.from(parts[1]);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>;
    return payload.provider === provider &&
      payload.userId === userId &&
      payload.organizationId === organizationId &&
      typeof payload.nonce === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(payload.nonce) &&
      typeof payload.issuedAt === 'number' &&
      Number.isFinite(payload.issuedAt) &&
      payload.issuedAt <= now &&
      now - payload.issuedAt <= TTL_MS;
  } catch {
    return false;
  }
}
