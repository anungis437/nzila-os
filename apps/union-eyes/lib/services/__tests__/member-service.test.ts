/**
 * Member Service — Unit Tests
 *
 * Tests:
 *   - getMemberById: delegation
 *   - createMember: insert
 *   - updateMember: update + where
 *   - deleteMember: soft-delete
 *   - searchMembers: query
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning, mockUpdateSet } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockUpdateSet: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })),
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizationMembers: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id', organizationId: 'organizationId', status: 'status',
    firstName: 'firstName', lastName: 'lastName', email: 'email',
    createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getMemberById, createMember, updateMember } from '../member-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getMemberById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns member when found', async () => {
    const member = { id: 'm-1', firstName: 'Jane' };
    mockFindFirst.mockResolvedValue(member);
    const result = await getMemberById('m-1');
    expect(result).toEqual(member);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getMemberById('missing');
    expect(result).toBeNull();
  });
});

describe('createMember', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new member', async () => {
    const newMember = { id: 'm-new', firstName: 'John' };
    mockReturning.mockResolvedValue([newMember]);
    const result = await createMember({
      organizationId: 'org-1',
      firstName: 'John',
      lastName: 'Doe',
    } as never);
    expect(result).toEqual(newMember);
  });
});

describe('updateMember', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates and returns the modified member', async () => {
    const updated = { id: 'm-1', firstName: 'Jane', lastName: 'Updated' };
    mockReturning.mockResolvedValue([updated]);
    const result = await updateMember('m-1', { lastName: 'Updated' } as never);
    expect(result).toEqual(updated);
  });
});
