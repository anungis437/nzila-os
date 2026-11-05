import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseOAuthCallbackParameters, selectUniquePublishingOrganization } from '../oauth-callback-safety';

describe('OAuth callback authority ambiguity', () => {
  it.each(['code', 'state', 'error'])('rejects duplicate %s values before any exchange', (key) => {
    const params = new URLSearchParams({ code: 'authorization', state: 'nonce' });
    params.append(key, 'attacker-controlled');
    expect(parseOAuthCallbackParameters(params)).toEqual({ ok: false });
  });

  it('rejects a callback containing both an authorization code and a provider denial', () => {
    expect(parseOAuthCallbackParameters(new URLSearchParams('state=nonce&code=authorization&error=access_denied'))).toEqual({ ok: false });
  });

  it('preserves legitimate single-code and single-error provider redirects', () => {
    expect(parseOAuthCallbackParameters(new URLSearchParams('state=nonce&code=authorization'))).toEqual({
      ok: true, state: 'nonce', code: 'authorization', providerError: null,
    });
    expect(parseOAuthCallbackParameters(new URLSearchParams('state=nonce&error=access_denied'))).toEqual({
      ok: true, state: 'nonce', code: null, providerError: 'access_denied',
    });
  });

  it('never selects the first LinkedIn organization when multiple are administered', () => {
    const pageA = { id: 'a' };
    const pageB = { id: 'b' };
    expect(selectUniquePublishingOrganization([])).toBeNull();
    expect(selectUniquePublishingOrganization([pageA])).toBe(pageA);
    expect(selectUniquePublishingOrganization([pageA, pageB])).toBeNull();
    expect(selectUniquePublishingOrganization([pageB, pageA])).toBeNull();
  });

  it('wires both guards into the callback before cookie consumption and credential persistence', () => {
    const route = readFileSync(join(__dirname, '..', '..', '..', 'app/api/social-media/accounts/callback/route.ts'), 'utf8');
    const parseAt = route.indexOf('parseOAuthCallbackParameters(request.nextUrl.searchParams)');
    const clearAt = route.indexOf('clearOAuthCookies(cookieStore);');
    const orgAt = route.indexOf('selectUniquePublishingOrganization(orgs)');
    const storeAt = route.indexOf('.insert(socialAccounts)');
    expect(parseAt).toBeGreaterThan(0);
    expect(clearAt).toBeGreaterThan(parseAt);
    expect(orgAt).toBeGreaterThan(clearAt);
    expect(storeAt).toBeGreaterThan(orgAt);
    expect(route).not.toContain('const org = orgs[0]');
  });
});
