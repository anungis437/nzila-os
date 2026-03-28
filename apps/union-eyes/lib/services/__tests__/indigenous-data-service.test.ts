/**
 * Indigenous Data Service — Unit Tests
 *
 * Tests:
 *   - verifyBandCouncilOwnership queries DB
 *   - handles member not found
 *   - respects OCAP principles (active consent check)
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      indigenousMemberData: { findFirst: mockFindFirst },
      bandCouncilConsent: { findFirst: mockFindFirst },
      bandCouncils: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  bandCouncils: {},
  bandCouncilConsent: {},
  indigenousMemberData: {},
  indigenousDataAccessLog: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-abcd'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { IndigenousDataService } from '../indigenous-data-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('IndigenousDataService', () => {
  let service: IndigenousDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IndigenousDataService();
    mockFindFirst.mockResolvedValue(undefined);
  });

  it('verifyBandCouncilOwnership returns no agreement when member not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await service.verifyBandCouncilOwnership('nonexistent');
    expect(result.hasAgreement).toBe(false);
    expect(result.reason).toContain('not associated');
  });

  it('verifyBandCouncilOwnership returns no agreement when member has no band council', async () => {
    mockFindFirst.mockResolvedValue({ userId: 'member-1', bandCouncilId: null });

    const result = await service.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(false);
  });

  it('verifyBandCouncilOwnership returns agreement when active consent exists', async () => {
    // Call order: indigenousMemberData → bandCouncilConsent → bandCouncils
    let callCount = 0;
    mockFindFirst.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { userId: 'member-1', bandCouncilId: 'bc-1' };
      }
      if (callCount === 2) {
        return { id: 'consent-1', consentGiven: true, expiresAt: null, bandCouncilId: 'bc-1' };
      }
      if (callCount === 3) {
        return { id: 'bc-1', bandName: 'Test Band Council' };
      }
      return undefined;
    });

    const result = await service.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(true);
    expect(result.bandName).toBe('Test Band Council');
    expect(result.agreementId).toBe('consent-1');
  });

  it('handles database error gracefully', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB connection failed'));

    const result = await service.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(false);
    expect(result.reason).toContain('Database error');
  });
});
