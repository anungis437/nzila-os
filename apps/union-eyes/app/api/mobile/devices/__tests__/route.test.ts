import { describe, it, expect } from 'vitest';
import { assertPushDeviceProfilePresent, buildPushDeviceCreateValues } from '../route';

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

    it.each([
      ['empty token', { deviceToken: '   ', platform: 'ios' }],
      ['unknown platform', { deviceToken: 'tok', platform: 'blackberry' }],
      ['invalid hour', { deviceToken: 'tok', platform: 'ios', quietHoursStart: '24:00' }],
      ['invalid minute', { deviceToken: 'tok', platform: 'ios', quietHoursEnd: '12:60' }],
      ['time injection', { deviceToken: 'tok', platform: 'ios', quietHoursStart: '12:00; DROP TABLE devices' }],
      ['non-boolean enabled', { deviceToken: 'tok', platform: 'ios', enabled: 'true' }],
      ['invalid timezone', { deviceToken: 'tok', platform: 'ios', timezone: 'Mars/Phobos' }],
      ['overlong device name', { deviceToken: 'tok', platform: 'ios', deviceName: 'a'.repeat(256) }],
    ])('rejects %s before reaching the database', (_case, values) => {
      expect(() => buildPushDeviceCreateValues(values, 'caller')).toThrow();
    });

    it('accepts bounded device preferences and a real IANA timezone', () => {
      const values = buildPushDeviceCreateValues({
        deviceToken: 'tok',
        platform: 'web',
        enabled: false,
        quietHoursStart: '22:30',
        quietHoursEnd: '07:15',
        timezone: 'America/Toronto',
      }, 'caller');
      expect(values.profileId).toBe('caller');
      expect(values.quietHoursStart).toBe('22:30');
    });

    it('refuses an absent authenticated subject', () => {
      expect(() => buildPushDeviceCreateValues({ deviceToken: 'tok', platform: 'ios' }, null)).toThrow();
    });
  });

  describe('profile FK precondition', () => {
    it('rejects a member whose profile has not been provisioned', () => {
      expect(() => assertPushDeviceProfilePresent([])).toThrow('Complete member profile setup');
    });
    it('accepts an existing profile without provisioning or inventing a row', () => {
      expect(() => assertPushDeviceProfilePresent([{ id: 'existing-profile' }])).not.toThrow();
    });
  });
});
