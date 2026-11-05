import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateOAuthCallbackContext, type OAuthCallbackContext } from '../oauth-callback-state';

const valid = (): OAuthCallbackContext => ({
  state: 'random-state', code: 'temporary-code', providerError: null,
  userId: 'member-1', organizationId: 'organization-1',
  storedState: 'random-state', storedPlatform: 'facebook',
  storedUserId: 'member-1', storedOrganizationId: 'organization-1', codeVerifier: null,
});

describe('OAuth callback pending-cookie safety', () => {
  it.each([
    ['missing state', { state: null }, 'state_mismatch'],
    ['forged state', { state: 'forged' }, 'state_mismatch'],
    ['missing stored state', { storedState: null }, 'state_mismatch'],
    ['different session', { userId: 'attacker' }, 'session_mismatch'],
    ['changed organization', { organizationId: 'other' }, 'organization_mismatch'],
    ['unknown platform', { storedPlatform: 'fake' }, 'unsupported_platform'],
    ['missing code', { code: null }, 'missing_authorization_code'],
    ['missing Twitter verifier', { storedPlatform: 'twitter' }, 'missing_pkce_verifier'],
  ] as const)('rejects %s before cookie consumption', (_label, changed, reason) => {
    expect(validateOAuthCallbackContext({ ...valid(), ...changed })).toEqual({ ok: false, reason });
  });

  it('accepts a legitimate authorization-code callback', () => {
    expect(validateOAuthCallbackContext(valid())).toEqual({ ok: true, platform: 'facebook' });
  });

  it('consumes only an authentic provider refusal', () => {
    expect(validateOAuthCallbackContext({ ...valid(), code: null, providerError: 'access_denied' })).toEqual({ ok: true, platform: 'facebook' });
    expect(validateOAuthCallbackContext({ ...valid(), code: null, providerError: 'access_denied', state: 'forged' })).toEqual({ ok: false, reason: 'state_mismatch' });
  });

  it('performs callback validation before it clears the pending cookies or exchanges credentials', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/social-media/accounts/callback/route.ts'), 'utf8');
    const validateAt = route.indexOf('const checked = validateOAuthCallbackContext(');
    const consumeAt = route.indexOf('clearOAuthCookies(cookieStore);');
    const exchangeAt = route.indexOf('getAccessToken(authorizedCode, redirectUri');
    expect(validateAt).toBeGreaterThan(0);
    expect(consumeAt).toBeGreaterThan(validateAt);
    expect(exchangeAt).toBeGreaterThan(consumeAt);
    expect(route.match(/clearOAuthCookies\(cookieStore\);/g)?.length).toBe(1);
  });
});
