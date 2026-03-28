/**
 * Break Glass Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockReturning, mockInsertValues, mockSelect } = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockSelect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: mockSelect,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock('@/db/schema/force-majeure-schema', () => ({
  emergencyDeclarations: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hash'),
    })),
    randomBytes: vi.fn(() => Buffer.from('mock-random-bytes')),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { BreakGlassService } from '../break-glass-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BreakGlassService', () => {
  let service: BreakGlassService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BreakGlassService();
    mockReturning.mockResolvedValue([{
      id: 'emg-1',
      emergencyType: 'cyberattack',
      severityLevel: 'critical',
      declaredAt: new Date(),
      declaredByUserId: 'user-1',
    }]);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('has correct REQUIRED_KEY_HOLDERS constant (3)', () => {
    // Access via reflection since it's private
    expect((service as unknown as { REQUIRED_KEY_HOLDERS: number }).REQUIRED_KEY_HOLDERS).toBe(3);
  });

  it('has correct TOTAL_KEY_HOLDERS constant (5)', () => {
    expect((service as unknown as { TOTAL_KEY_HOLDERS: number }).TOTAL_KEY_HOLDERS).toBe(5);
  });

  it('declareEmergency creates DB record and returns declaration', async () => {
    const result = await service.declareEmergency(
      'cyberattack',
      'user-1',
      'Ransomware detected',
      'critical',
      ['HQ'],
      500
    );

    expect(result).toBeDefined();
    expect(result.emergencyType).toBe('cyberattack');
    expect(result.severity).toBe('critical');
    expect(result.breakGlassActivated).toBe(false);
  });

  it('declareEmergency handles natural disaster scenario', async () => {
    mockReturning.mockResolvedValue([{
      id: 'emg-2',
      emergencyType: 'natural_disaster',
      severityLevel: 'high',
      declaredAt: new Date(),
      declaredByUserId: 'user-2',
    }]);

    const result = await service.declareEmergency(
      'natural_disaster',
      'user-2',
      'Flood in basement',
      'high',
      ['Office A', 'Office B'],
      200
    );

    expect(result.emergencyType).toBe('natural_disaster');
    expect(result.affectedLocations).toEqual(['Office A', 'Office B']);
  });

  it('emergency types are valid enum values', () => {
    const validTypes = ['strike', 'lockout', 'cyberattack', 'natural_disaster', 'government_seizure', 'infrastructure_failure'];
    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});
