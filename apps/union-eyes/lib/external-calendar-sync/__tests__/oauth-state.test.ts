import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  issueCalendarOAuthState,
  verifyCalendarOAuthState,
  setCalendarOAuthStateCookie,
  clearCalendarOAuthStateCookie,
} from '../oauth-state';

const SECRET = 'ab'.repeat(32);
const now = Date.UTC(2026, 9, 30, 17, 0);
const cookieName = 'ue_calendar_oauth_google';
function request(state: string | null, cookie: string | null = state) {
  const params = new URLSearchParams({ code: 'provider-code' });
  if (state !== null) params.set('state', state);
  return new NextRequest(`https://app.example.org/api/calendar-sync/google/callback?${params}`, {
    headers: cookie === null ? {} : { cookie: `${cookieName}=${cookie}` },
  });
}

describe('calendar OAuth CSRF state', () => {
  const originalStateKey = process.env.CALENDAR_OAUTH_STATE_SECRET;
  const originalTokenKey = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  beforeEach(() => { process.env.CALENDAR_OAUTH_STATE_SECRET = SECRET; });
  afterEach(() => {
    if (originalStateKey === undefined) delete process.env.CALENDAR_OAUTH_STATE_SECRET;
    else process.env.CALENDAR_OAUTH_STATE_SECRET = originalStateKey;
    if (originalTokenKey === undefined) delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
    else process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = originalTokenKey;
  });

  it('issues a different unpredictable state for every flow and binds it to the browser', () => {
    const first = issueCalendarOAuthState('google', 'user-1', 'org-a', now);
    const second = issueCalendarOAuthState('google', 'user-1', 'org-a', now);
    expect(first).not.toBe(second);
    expect(first).not.toContain('user-1');
    expect(verifyCalendarOAuthState(request(first), 'google', first, 'user-1', 'org-a', now + 1000)).toBe(true);
    expect(verifyCalendarOAuthState(request(first, null), 'google', first, 'user-1', 'org-a', now)).toBe(false);
    expect(verifyCalendarOAuthState(request(first, second), 'google', first, 'user-1', 'org-a', now)).toBe(false);
  });

  it('rejects missing, tampered, wrong provider, user, organization and expired state before token exchange', () => {
    const state = issueCalendarOAuthState('google', 'user-1', 'org-a', now);
    expect(verifyCalendarOAuthState(request(null, state), 'google', null, 'user-1', 'org-a', now)).toBe(false);
    expect(verifyCalendarOAuthState(request(state), 'google', state, 'user-2', 'org-a', now)).toBe(false);
    expect(verifyCalendarOAuthState(request(state), 'google', state, 'user-1', 'org-b', now)).toBe(false);
    expect(verifyCalendarOAuthState(request(state), 'microsoft', state, 'user-1', 'org-a', now)).toBe(false);
    expect(verifyCalendarOAuthState(request(state), 'google', state, 'user-1', 'org-a', now + 600_001)).toBe(false);
    expect(verifyCalendarOAuthState(request(state), 'google', state, 'user-1', 'org-a', now - 1)).toBe(false);
    const forged = state.slice(0, -2) + 'xx';
    expect(verifyCalendarOAuthState(request(forged), 'google', forged, 'user-1', 'org-a', now)).toBe(false);
  });

  it('uses an HttpOnly, SameSite cookie scoped to the callback and clears it on success', () => {
    const response = NextResponse.redirect('https://accounts.example.org/');
    const state = issueCalendarOAuthState('google', 'user-1', 'org-a', now);
    setCalendarOAuthStateCookie(response, 'google', state);
    expect(response.cookies.get(cookieName)?.value).toBe(state);
    const header = response.headers.get('set-cookie') || '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=lax');
    expect(header).toContain('/api/calendar-sync/google/callback');
    clearCalendarOAuthStateCookie(response, 'google');
    expect(response.cookies.get(cookieName)?.value).toBe('');
  });

  it('fails closed without a signing key', () => {
    delete process.env.CALENDAR_OAUTH_STATE_SECRET;
    delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
    expect(() => issueCalendarOAuthState('google', 'user-1', 'org-a', now)).toThrow('not configured');
  });
});
