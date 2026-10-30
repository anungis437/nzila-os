import { describe, it, expect } from 'vitest';
import { assertDeviceNotOwnedByAnotherUser, parseDeviceRegistration } from '../route';

// Gate 0 DEF-0B9-MOB-SYNC-PATH / DEVICE-REREGISTRATION: registration is validated against the column limits, a browser needs
// no push token, and a native device must supply one.
describe('parseDeviceRegistration', () => {
  it('accepts the body the Sync now button sends (a browser with no token) and keys it by device id', () => {
    const result = parseDeviceRegistration({ deviceId: 'dev-1', platform: 'pwa' });
    expect(result).toMatchObject({ ok: true, value: { deviceToken: 'pwa:dev-1', pushCapable: false } });
  });

  it('requires a push token from a native device', () => {
    expect(parseDeviceRegistration({ deviceId: 'dev-1', platform: 'ios' })).toMatchObject({ ok: false });
    expect(parseDeviceRegistration({ deviceId: 'dev-1', platform: 'android', deviceToken: 'tok-12345678' })).toMatchObject({ ok: true, value: { pushCapable: true } });
  });

  it('refuses values the columns cannot hold and fields it does not know', () => {
    for (const bad of [
      { deviceId: 'd', platform: 'symbian' },
      { deviceId: 'd', platform: 'pwa', appVersion: 'x'.repeat(21) },
      { deviceId: 'd', platform: 'pwa', osVersion: 'x'.repeat(51) },
      { deviceId: 'd', platform: 'pwa', deviceName: 'x'.repeat(256) },
      { deviceId: 'x'.repeat(256), platform: 'pwa' },
      { deviceId: 'd', platform: 'pwa', isJailbroken: false },
      { deviceId: 'd', platform: 'pwa', userId: 'someone-else' },
      {},
      null,
    ]) {
      expect(parseDeviceRegistration(bad), JSON.stringify(bad)).toMatchObject({ ok: false });
    }
  });
});

// ROUND 50 REGRESSION: the POST handler previously upserted on deviceId
// alone with no ownership check, letting any authenticated user hijack
// another user's mobile_devices row (and their push notification channel)
// by supplying that row's deviceId.
describe('mobile/sync route helpers', () => {
  describe('assertDeviceNotOwnedByAnotherUser', () => {
    it('does not throw when no existing row is found for the deviceId', () => {
      expect(() => assertDeviceNotOwnedByAnotherUser(undefined, 'caller-user')).not.toThrow();
    });

    it('does not throw when the existing row belongs to the caller', () => {
      expect(() => assertDeviceNotOwnedByAnotherUser('caller-user', 'caller-user')).not.toThrow();
    });

    it('throws a conflict when the existing row belongs to another user', () => {
      expect(() => assertDeviceNotOwnedByAnotherUser('victim-user', 'attacker-user')).toThrow(
        'This device is already registered to another account',
      );
    });
  });
});
