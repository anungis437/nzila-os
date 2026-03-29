/**
 * Break Glass Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mocks.mockReturning })),
  mockSelect: vi.fn(),
  mockUpdateWhere: vi.fn().mockResolvedValue([]),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mocks.mockInsertValues })),
    select: mocks.mockSelect,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.mockUpdateWhere,
      })),
    })),
    query: {
      emergencyDeclarations: {
        findFirst: mocks.mockFindFirst,
        findMany: mocks.mockFindMany,
      },
    },
  },
}));

vi.mock('@/db/schema/force-majeure-schema', () => ({
  emergencyDeclarations: { id: 'id', resolvedAt: 'resolvedAt' },
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
      digest: vi.fn(() => 'mock-hash-abcdef0123456789'),
    })),
    randomBytes: vi.fn(() => Buffer.from('a'.repeat(32))),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { BreakGlassService, type KeyHolderAuth } from '../break-glass-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKeyHolders(count: number): KeyHolderAuth[] {
  const roles = ['union_president', 'union_treasurer', 'legal_counsel', 'platform_cto', 'independent_trustee'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    role: roles[i]!,
    name: `Holder ${i + 1}`,
    keyFragment: 'a'.repeat(64),
    verifiedAt: new Date(),
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BreakGlassService', () => {
  let service: BreakGlassService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    service = new BreakGlassService();
    mocks.mockReturning.mockResolvedValue([{
      id: 'emg-1',
      emergencyType: 'cyberattack',
      severityLevel: 'critical',
      declaredAt: new Date(),
      declaredByUserId: 'user-1',
    }]);
    mocks.mockFindFirst.mockResolvedValue(null);
    mocks.mockFindMany.mockResolvedValue([]);
  });

  // ── Constants ──────────────────────────────────────────────────────
  it('has correct REQUIRED_KEY_HOLDERS constant (3)', () => {
    expect((service as any).REQUIRED_KEY_HOLDERS).toBe(3);
  });

  it('has correct TOTAL_KEY_HOLDERS constant (5)', () => {
    expect((service as any).TOTAL_KEY_HOLDERS).toBe(5);
  });

  // ── declareEmergency ──────────────────────────────────────────────
  it('declareEmergency creates DB record and returns declaration', async () => {
    const result = await service.declareEmergency(
      'cyberattack', 'user-1', 'Ransomware detected', 'critical', ['HQ'], 500,
    );
    expect(result.emergencyType).toBe('cyberattack');
    expect(result.severity).toBe('critical');
    expect(result.breakGlassActivated).toBe(false);
    expect(result.affectedLocations).toEqual(['HQ']);
  });

  it('declareEmergency handles natural disaster scenario', async () => {
    mocks.mockReturning.mockResolvedValue([{
      id: 'emg-2', emergencyType: 'natural_disaster', severityLevel: 'high',
      declaredAt: new Date(), declaredByUserId: 'user-2',
    }]);
    const result = await service.declareEmergency(
      'natural_disaster', 'user-2', 'Flood', 'high', ['Office A', 'Office B'], 200,
    );
    expect(result.emergencyType).toBe('natural_disaster');
    expect(result.affectedLocations).toEqual(['Office A', 'Office B']);
  });

  // ── verifyKeyHolder ───────────────────────────────────────────────
  it('verifyKeyHolder returns true for valid key fragment', async () => {
    const holder = makeKeyHolders(1)[0]!;
    expect(await service.verifyKeyHolder(holder)).toBe(true);
  });

  it('verifyKeyHolder returns false for short key fragment', async () => {
    const holder = makeKeyHolders(1)[0]!;
    holder.keyFragment = 'short';
    expect(await service.verifyKeyHolder(holder)).toBe(false);
  });

  it('verifyKeyHolder returns false for empty key fragment', async () => {
    const holder = makeKeyHolders(1)[0]!;
    holder.keyFragment = '';
    expect(await service.verifyKeyHolder(holder)).toBe(false);
  });

  // ── activateBreakGlass ────────────────────────────────────────────
  it('rejects with insufficient key holders', async () => {
    const result = await service.activateBreakGlass('emg-1', makeKeyHolders(2));
    expect(result.success).toBe(false);
    expect(result.message).toContain('Requires 3');
  });

  it('rejects when a key holder verification fails', async () => {
    const holders = makeKeyHolders(3);
    holders[1]!.keyFragment = 'bad';
    const result = await service.activateBreakGlass('emg-1', holders);
    expect(result.success).toBe(false);
    expect(result.message).toContain('verification failed');
  });

  it('succeeds with 3 valid key holders', async () => {
    const result = await service.activateBreakGlass('emg-1', makeKeyHolders(3));
    expect(result.success).toBe(true);
    expect(result.masterKey).toBeDefined();
    expect(result.coldStorageAccess).toContain('COLD_STORAGE_ACCESS_');
    expect(result.message).toContain('Break-glass activated');
  });

  it('succeeds with all 5 key holders', async () => {
    const result = await service.activateBreakGlass('emg-1', makeKeyHolders(5));
    expect(result.success).toBe(true);
  });

  // ── recover48Hour ─────────────────────────────────────────────────
  it('recover48Hour returns recovery status', async () => {
    const result = await service.recover48Hour('swiss', 'access-key');
    expect(result.success).toBe(true);
    expect(result.within48Hours).toBe(true);
    expect(result.dataLoss).toBe(0);
    expect(result.backupSource).toBe('swiss');
  });

  it('recover48Hour works with canadian backup', async () => {
    const result = await service.recover48Hour('canadian', 'access-key');
    expect(result.backupSource).toBe('canadian');
    expect(result.success).toBe(true);
  });

  // ── scheduleAudit ─────────────────────────────────────────────────
  it('scheduleAudit returns deadline 7 days in future', async () => {
    const before = new Date();
    const result = await service.scheduleAudit('emg-1');
    const diff = (result.auditDeadline.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThanOrEqual(6.9);
    expect(diff).toBeLessThanOrEqual(7.1);
    expect(result.message).toContain('Audit must be completed');
  });

  // ── resolveEmergency ──────────────────────────────────────────────
  it('resolveEmergency updates DB and returns resolved status', async () => {
    const result = await service.resolveEmergency('emg-1');
    expect(result.success).toBe(true);
    expect(result.resolvedAt).toBeInstanceOf(Date);
    expect(result.message).toContain('resolved');
  });

  // ── getEmergencyStatus ────────────────────────────────────────────
  it('getEmergencyStatus returns declaration when found', async () => {
    mocks.mockFindFirst.mockResolvedValue({
      id: 'emg-1',
      emergencyType: 'strike',
      severityLevel: 'high',
      declaredByUserId: 'u-1',
      declaredAt: new Date(),
      notes: 'Strike declared',
      affectedLocations: ['Plant A'],
      affectedMemberCount: 100,
      breakGlassActivated: false,
    });
    const result = await service.getEmergencyStatus('emg-1');
    expect(result).not.toBeNull();
    expect(result!.emergencyType).toBe('strike');
    expect(result!.affectedMemberCount).toBe(100);
  });

  it('getEmergencyStatus returns null when not found', async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    expect(await service.getEmergencyStatus('missing')).toBeNull();
  });

  // ── getActiveEmergencies ──────────────────────────────────────────
  it('getActiveEmergencies returns sorted list', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 3600000);
    mocks.mockFindMany.mockResolvedValue([
      { id: 'e1', emergencyType: 'strike', severityLevel: 'low', declaredByUserId: 'u1', declaredAt: earlier, notes: '', affectedLocations: null, affectedMemberCount: 0, breakGlassActivated: false },
      { id: 'e2', emergencyType: 'lockout', severityLevel: 'high', declaredByUserId: 'u2', declaredAt: now, notes: '', affectedLocations: null, affectedMemberCount: 0, breakGlassActivated: false },
    ]);
    const result = await service.getActiveEmergencies();
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('e2'); // newer first
    expect(result[1]!.id).toBe('e1');
  });

  it('getActiveEmergencies returns empty array when none active', async () => {
    mocks.mockFindMany.mockResolvedValue([]);
    expect(await service.getActiveEmergencies()).toEqual([]);
  });
});
