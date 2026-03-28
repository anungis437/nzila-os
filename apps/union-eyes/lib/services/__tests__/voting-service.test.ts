/**
 * Voting Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockReturning, mockInsertValues, mockSelect } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockSelect: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      votingSessions: { findFirst: mockFindFirst, findMany: mockFindMany },
      votingOptions: { findFirst: mockFindFirst, findMany: mockFindMany },
      votes: { findFirst: mockFindFirst },
      voterEligibility: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: mockSelect,
  },
}));

vi.mock('@/db/schema', () => ({
  votingSessions: {},
  votingOptions: {},
  votes: {},
  voterEligibility: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('../voting-crypto-service', () => ({
  deriveVotingSessionKey: vi.fn(() => 'mock-session-key'),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hash'),
    })),
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-hmac'),
    })),
  };
});

vi.mock('@/lib/config/env-validation', () => ({
  env: { VOTING_SECRET: 'test-secret' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getVotingSessionById, listVotingSessions } from '../voting-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VotingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
    mockFindMany.mockResolvedValue([]);
    mockReturning.mockResolvedValue([]);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
  });

  it('getVotingSessionById returns null when session not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getVotingSessionById('nonexistent');
    expect(result).toBeNull();
  });

  it('getVotingSessionById returns session data', async () => {
    const mockSession = {
      id: 'session-1',
      title: 'Board Election',
      status: 'active',
      organizationId: 'org-1',
    };
    mockFindFirst.mockResolvedValue(mockSession);

    const result = await getVotingSessionById('session-1');
    expect(result).toEqual(mockSession);
  });

  it('getVotingSessionById includes options when requested', async () => {
    const mockSession = { id: 'session-1', title: 'Vote', status: 'active' };
    mockFindFirst.mockResolvedValue(mockSession);

    const mockOptions = [{ id: 'opt-1', text: 'Yes' }];
    const mockCount = [{ count: 5 }];

    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockOptions),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCount),
        }),
      });

    const result = await getVotingSessionById('session-1', true);
    expect(result?.options).toEqual(mockOptions);
    expect(result?.voteCount).toBe(5);
  });

  it('listVotingSessions returns paginated results', async () => {
    const mockSessions = [{ id: 's1' }, { id: 's2' }];
    mockSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockSessions),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

    const result = await listVotingSessions({}, { page: 1, limit: 20 });
    expect(result.sessions).toEqual(mockSessions);
  });
});
