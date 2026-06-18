import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const returning = vi.fn();
const values = vi.fn(() => ({ returning }));
const insert = vi.fn(() => ({ values }));

vi.mock('@/db/db', () => ({
  db: {
    query: { userUuidMapping: { findFirst } },
    insert,
  },
}));
vi.mock('@/db/schema', () => ({
  userUuidMapping: { clerkUserId: { name: 'clerkUserId' } },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})) }));

describe('lib/utils/user-uuid-helpers', () => {
  beforeEach(() => {
    findFirst.mockReset();
    returning.mockReset();
    values.mockClear();
    insert.mockClear();
  });

  it('returns the existing mapping uuid when found', async () => {
    findFirst.mockResolvedValue({ userUuid: 'uuid-existing' });

    const { getOrCreateUserUuid } = await import('../user-uuid-helpers');
    const result = await getOrCreateUserUuid('user-123');

    expect(result).toBe('uuid-existing');
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates and returns a new mapping uuid when not found', async () => {
    findFirst.mockResolvedValue(undefined);
    returning.mockResolvedValue([{ userUuid: 'uuid-new' }]);

    const { getOrCreateUserUuid } = await import('../user-uuid-helpers');
    const result = await getOrCreateUserUuid('user-456');

    expect(result).toBe('uuid-new');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({ clerkUserId: 'user-456' });
  });
});
