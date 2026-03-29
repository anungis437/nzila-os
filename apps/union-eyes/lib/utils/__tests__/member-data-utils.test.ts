import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockForEach: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit,
        }),
      }),
    }),
  },
}));

vi.mock('@/db/schema/domains/member', () => ({
  profilesTable: { userId: 'user_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

import {
  getMemberDetailsByUserId,
  getMemberDetailsById,
  getMemberName,
  batchGetMemberDetails,
} from '../member-data-utils';

/* ── helpers ─────────────────────────────────────────────────────── */
function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    status: 'active',
    ...overrides,
  };
}

/* ── tests ───────────────────────────────────────────────────────── */
describe('member-data-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain each test
    mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          limit: mocks.mockLimit,
        }),
      }),
    });
  });

  // ── getMemberDetailsByUserId ──────────────────────────────────────
  describe('getMemberDetailsByUserId', () => {
    it('returns null when profile not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const result = await getMemberDetailsByUserId('unknown');
      expect(result).toBeNull();
    });

    it('returns mapped profile when found', async () => {
      mocks.mockLimit.mockResolvedValue([makeProfile()]);
      const result = await getMemberDetailsByUserId('user-1');
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.email).toBe('test@example.com');
      expect(result!.status).toBe('active');
      expect(result!.phone).toBeNull();
      expect(result!.memberNumber).toBeNull();
    });

    it('uses fallback values when email is null', async () => {
      mocks.mockLimit.mockResolvedValue([makeProfile({ email: null })]);
      const result = await getMemberDetailsByUserId('user-1');
      expect(result!.name).toBe('Unknown Member');
      expect(result!.email).toBe('');
    });

    it('uses fallback "active" when status is null', async () => {
      mocks.mockLimit.mockResolvedValue([makeProfile({ status: null })]);
      const result = await getMemberDetailsByUserId('user-1');
      expect(result!.status).toBe('active');
    });

    it('returns null on db error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB connection failed'));
      const result = await getMemberDetailsByUserId('user-1');
      expect(result).toBeNull();
    });
  });

  // ── getMemberDetailsById ──────────────────────────────────────────
  describe('getMemberDetailsById', () => {
    it('returns null when not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const result = await getMemberDetailsById('missing-id');
      expect(result).toBeNull();
    });

    it('returns mapped member with email fallbacks', async () => {
      mocks.mockLimit.mockResolvedValue([makeProfile({ email: null, status: null })]);
      const result = await getMemberDetailsById('user-1');
      expect(result!.name).toBe('Unknown Member');
      expect(result!.email).toBe('');
      expect(result!.status).toBe('active');
    });

    it('returns null on db error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('timeout'));
      const result = await getMemberDetailsById('user-1');
      expect(result).toBeNull();
    });
  });

  // ── getMemberName ─────────────────────────────────────────────────
  describe('getMemberName', () => {
    it('returns name when member found', async () => {
      mocks.mockLimit.mockResolvedValue([makeProfile({ email: 'jane@example.com' })]);
      const name = await getMemberName('user-1');
      expect(name).toBe('jane@example.com');
    });

    it('returns "Unknown Member" when not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const name = await getMemberName('unknown');
      expect(name).toBe('Unknown Member');
    });
  });

  // ── batchGetMemberDetails ─────────────────────────────────────────
  describe('batchGetMemberDetails', () => {
    it('returns empty map for empty input', async () => {
      const result = await batchGetMemberDetails([]);
      expect(result.size).toBe(0);
    });

    it('returns populated map for valid userIds', async () => {
      // batchGetMemberDetails uses the same chain but with .where().limit-less
      // Restructure the mock for the non-limit query
      const mockProfiles = [
        makeProfile({ userId: 'u-1', email: 'a@test.com' }),
        makeProfile({ userId: 'u-2', email: null }),
      ];
      // batch uses .select().from().where() without .limit() on the third step
      mocks.mockWhere.mockResolvedValue(mockProfiles);
      const result = await batchGetMemberDetails(['u-1', 'u-2']);
      expect(result.size).toBe(2);
      expect(result.get('u-1')!.email).toBe('a@test.com');
      // null email fallbacks
      expect(result.get('u-2')!.name).toBe('Unknown Member');
      expect(result.get('u-2')!.email).toBe('');
    });

    it('returns empty map with null status fallback', async () => {
      mocks.mockWhere.mockResolvedValue([
        makeProfile({ userId: 'u-3', status: null }),
      ]);
      const result = await batchGetMemberDetails(['u-3']);
      expect(result.get('u-3')!.status).toBe('active');
    });

    it('returns empty map on db error', async () => {
      mocks.mockWhere.mockRejectedValue(new Error('network error'));
      const result = await batchGetMemberDetails(['u-1']);
      expect(result.size).toBe(0);
    });
  });
});
