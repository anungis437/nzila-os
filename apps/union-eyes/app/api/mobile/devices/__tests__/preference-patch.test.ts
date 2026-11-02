import { describe, expect, it, vi } from 'vitest';
import { validatePushDevicePreferences } from '../push-device-preferences';
import { crudRoutes } from '@/lib/api/crud-factory';

// Capture the actual item route configuration without opening a database.
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn(() => ({ GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() })),
}));
import '../[id]/route';

const options = vi.mocked(crudRoutes).mock.calls[0]?.[0];

describe('push-device preference PATCH boundary', () => {
  it('wires strict validation into the actual owner-scoped item route', async () => {
    expect(options?.itemRoute).toBe(true);
    expect(options?.orgScoped).toBe(true);
    expect(options?.ownerColumn).toBe('profileId');
    expect(options?.writableFields).not.toContain('deviceToken');
    expect(options?.beforeUpdate).toBeTypeOf('function');
    const patch = { enabled: false, quietHoursStart: '22:30', timezone: 'America/Toronto' };
    expect(await options!.beforeUpdate!(patch, {
      id: 'device-id', organizationId: 'org-id', userId: 'user-id', existing: {},
    })).toEqual(patch);
  });

  it.each([
    ['invalid start hour', { quietHoursStart: '24:00' }],
    ['invalid end minute', { quietHoursEnd: '07:60' }],
    ['ambiguous time', { quietHoursStart: '7:30' }],
    ['SQL-shaped time', { quietHoursEnd: '12:00; DROP TABLE push_devices' }],
    ['wrong time type', { quietHoursStart: 1200 }],
    ['invalid timezone', { timezone: 'Mars/Phobos' }],
    ['wrong timezone type', { timezone: 123 }],
    ['oversized timezone', { timezone: 'A'.repeat(65) }],
    ['nonboolean enabled', { enabled: 'false' }],
    ['null enabled', { enabled: null }],
    ['oversized device name', { deviceName: 'x'.repeat(256) }],
    ['wrong app version type', { appVersion: { injected: true } }],
    ['oversized os version', { osVersion: 'v'.repeat(256) }],
  ])('refuses %s before the item mutation', async (_name, input) => {
    expect(() => validatePushDevicePreferences(input)).toThrow();
    await expect(options!.beforeUpdate!(input, {
      id: 'device-id', organizationId: 'org-id', userId: 'user-id', existing: {},
    })).rejects.toThrow();
  });

  it('accepts null to clear nullable quiet hours, timezone and device name', () => {
    expect(() => validatePushDevicePreferences({
      quietHoursStart: null, quietHoursEnd: null, timezone: null, deviceName: null,
    })).not.toThrow();
  });

  it('does not mutate the caller input or invent preference defaults', () => {
    const input = { enabled: false, timezone: 'UTC' };
    const snapshot = JSON.stringify(input);
    validatePushDevicePreferences(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(Object.keys(input)).toEqual(['enabled', 'timezone']);
  });
});
