/**
 * Member Data Utils — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockQuery: {
    userUuidMapping: { findFirst: vi.fn() },
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    query: mocks.mockQuery,
  },
}));

vi.mock('@/db/schema/domains/member', () => ({
  profilesTable: {
    userId: 'user_id',
    email: 'email',
    status: 'status',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

import {
  getMemberDetailsByUserId,
  getMemberDetailsById,
  getMemberName,
  batchGetMemberDetails,
} from '../utils/member-data-utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSelectChain(rows: unknown[]) {
  mocks.mockLimit.mockResolvedValue(rows);
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

function setupBatchSelectChain(rows: unknown[]) {
  // batchGetMemberDetails doesn't use .limit()
  mocks.mockWhere.mockResolvedValue(rows);
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

const sampleProfile = {
  userId: 'user-abc',
  email: 'alice@example.com',
  status: 'active',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getMemberDetailsByUserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns member details when found', async () => {
    setupSelectChain([sampleProfile]);
    const result = await getMemberDetailsByUserId('user-abc');
    expect(result).toEqual({
      userId: 'user-abc',
      name: 'alice@example.com',
      email: 'alice@example.com',
      phone: null,
      memberNumber: null,
      status: 'active',
    });
  });

  it('returns null when not found', async () => {
    setupSelectChain([]);
    const result = await getMemberDetailsByUserId('user-missing');
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('DB error'); });
    const result = await getMemberDetailsByUserId('user-bad');
    expect(result).toBeNull();
  });

  it('defaults name to Unknown Member when email is empty', async () => {
    setupSelectChain([{ userId: 'u1', email: '', status: 'active' }]);
    const result = await getMemberDetailsByUserId('u1');
    expect(result?.name).toBe('Unknown Member');
  });

  it('defaults status to active when null', async () => {
    setupSelectChain([{ userId: 'u1', email: 'a@b.ca', status: null }]);
    const result = await getMemberDetailsByUserId('u1');
    expect(result?.status).toBe('active');
  });
});

describe('getMemberDetailsById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns member details when found', async () => {
    setupSelectChain([sampleProfile]);
    const result = await getMemberDetailsById('user-abc');
    expect(result?.userId).toBe('user-abc');
  });

  it('returns null when not found', async () => {
    setupSelectChain([]);
    expect(await getMemberDetailsById('missing')).toBeNull();
  });

  it('returns null on error', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('err'); });
    expect(await getMemberDetailsById('bad')).toBeNull();
  });
});

describe('getMemberName', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns member name when found', async () => {
    setupSelectChain([sampleProfile]);
    expect(await getMemberName('user-abc')).toBe('alice@example.com');
  });

  it('returns Unknown Member when not found', async () => {
    setupSelectChain([]);
    expect(await getMemberName('missing')).toBe('Unknown Member');
  });
});

describe('batchGetMemberDetails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map for empty input', async () => {
    const result = await batchGetMemberDetails([]);
    expect(result.size).toBe(0);
  });

  it('returns map of member details', async () => {
    setupBatchSelectChain([sampleProfile]);
    const result = await batchGetMemberDetails(['user-abc']);
    expect(result.get('user-abc')).toBeDefined();
    expect(result.get('user-abc')?.email).toBe('alice@example.com');
  });

  it('returns empty map on error', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('err'); });
    const result = await batchGetMemberDetails(['user-abc']);
    expect(result.size).toBe(0);
  });
});
