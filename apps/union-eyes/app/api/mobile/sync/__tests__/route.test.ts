import { describe, it, expect } from 'vitest';
import { assertDeviceNotOwnedByAnotherUser } from '../route';

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
