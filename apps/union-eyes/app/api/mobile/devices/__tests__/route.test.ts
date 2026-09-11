import { describe, it, expect } from 'vitest';
import { buildPushDeviceCreateValues } from '../route';

describe('mobile/devices route helpers', () => {
  describe('buildPushDeviceCreateValues', () => {
    it('forces profileId to the authenticated caller regardless of request body', () => {
      const result = buildPushDeviceCreateValues(
        { deviceToken: 'tok-1', platform: 'ios', profileId: 'attacker-controlled-user' },
        'real-caller-user',
      );
      expect(result.profileId).toBe('real-caller-user');
      expect(result.profileId).not.toBe('attacker-controlled-user');
    });

    it('sets profileId even when the request body omits it entirely', () => {
      const result = buildPushDeviceCreateValues({ deviceToken: 'tok-2', platform: 'android' }, 'real-caller-user');
      expect(result.profileId).toBe('real-caller-user');
    });

    it('preserves other request body fields unchanged', () => {
      const result = buildPushDeviceCreateValues(
        { deviceToken: 'tok-3', platform: 'ios', deviceName: 'iPhone' },
        'real-caller-user',
      );
      expect(result.deviceToken).toBe('tok-3');
      expect(result.platform).toBe('ios');
      expect(result.deviceName).toBe('iPhone');
    });
  });
});
