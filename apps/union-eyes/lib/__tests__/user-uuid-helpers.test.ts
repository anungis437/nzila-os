/**
 * User UUID Helpers — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      userUuidMapping: { findFirst: mocks.mockFindFirst },
    },
    insert: mocks.mockInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  userUuidMapping: { clerkUserId: 'clerk_user_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

import { getOrCreateUserUuid } from '../utils/user-uuid-helpers';

describe('getOrCreateUserUuid', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing UUID when mapping exists', async () => {
    mocks.mockFindFirst.mockResolvedValue({ clerkUserId: 'user_abc', userUuid: 'uuid-123' });
    const result = await getOrCreateUserUuid('user_abc');
    expect(result).toBe('uuid-123');
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it('creates new mapping when not found', async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    mocks.mockReturning.mockResolvedValue([{ clerkUserId: 'user_new', userUuid: 'uuid-new' }]);
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

    const result = await getOrCreateUserUuid('user_new');
    expect(result).toBe('uuid-new');
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it('passes clerkUserId to insert values', async () => {
    mocks.mockFindFirst.mockResolvedValue(null);
    mocks.mockReturning.mockResolvedValue([{ clerkUserId: 'user_x', userUuid: 'uuid-x' }]);
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

    await getOrCreateUserUuid('user_x');
    expect(mocks.mockValues).toHaveBeenCalledWith({ clerkUserId: 'user_x' });
  });
});
