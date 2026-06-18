/**
 * Voting Service — Unit Tests
 *
 * Covers getVotingSessionById, listVotingSessions, createVotingSession,
 * updateVotingSession, deleteVotingSession, addVotingOption, updateVotingOption,
 * deleteVotingOption, addVoterEligibility, bulkAddVoterEligibility,
 * checkVoterEligibility, updateVoterEligibility, castVote, hasVoted,
 * calculateResults, calculateRankedChoiceResults, setProxyVoter,
 * removeProxyVoter, getSessionStatistics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockSessionsFindFirst: vi.fn(),
  mockVotesFindFirst: vi.fn(),
  mockEligibilityFindFirst: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockSelect: vi.fn(),
}));

/** Recursive chain: every method returns the chain; await resolves to value */
function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (resolve: (v: any) => void) => resolve(resolveValue);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db/db', () => ({
  db: {
    query: {
      votingSessions: { findFirst: mocks.mockSessionsFindFirst },
      votes: { findFirst: mocks.mockVotesFindFirst },
      voterEligibility: { findFirst: mocks.mockEligibilityFindFirst },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mocks.mockUpdateReturning,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: mocks.mockDeleteWhere,
    })),
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema', () => ({
  votingSessions: { id: 'id', organizationId: 'orgId', status: 'status', type: 'type', startTime: 'startTime' },
  votingOptions: { id: 'id', sessionId: 'sessionId', orderIndex: 'orderIndex' },
  votes: { id: 'id', sessionId: 'sessionId', voterId: 'voterId', optionId: 'optionId', castAt: 'castAt', voterMetadata: 'voterMetadata' },
  voterEligibility: { id: 'id', sessionId: 'sessionId', memberId: 'memberId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  desc: vi.fn((a: any) => a),
  asc: vi.fn((a: any) => a),
  inArray: vi.fn((...a: any[]) => a),
  count: vi.fn(() => 'count_fn'),
  gte: vi.fn((...a: any[]) => a),
  lte: vi.fn((...a: any[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('../voting-crypto-service', () => ({
  deriveVotingSessionKey: vi.fn(() => 'a'.repeat(32)),
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash-hex'),
  })),
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hmac-hex-at-least-16-chars'),
  })),
}));

vi.mock('@/lib/config/env-validation', () => ({
  env: { VOTING_SECRET: 'a]b(c)D4E5F6G7H8I9J0K1L2M3N4O5P6Q' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  getVotingSessionById,
  listVotingSessions,
  createVotingSession,
  updateVotingSession,
  deleteVotingSession,
  addVotingOption,
  updateVotingOption,
  deleteVotingOption,
  addVoterEligibility,
  bulkAddVoterEligibility,
  checkVoterEligibility,
  updateVoterEligibility,
  castVote,
  hasVoted,
  calculateResults,
  calculateRankedChoiceResults,
  setProxyVoter,
  removeProxyVoter,
  getSessionStatistics,
} from '../voting-service';

/* ── helpers ────────────────────────────────────────────────────────── */

const baseSession = {
  id: 'session-1',
  organizationId: 'org-1',
  title: 'Board Election',
  status: 'active',
  type: 'standard',
  startTime: new Date('2025-06-01'),
  endTime: new Date('2025-06-02'),
  totalEligibleVoters: 100,
  requiresQuorum: true,
  quorumThreshold: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseOption = { id: 'opt-1', sessionId: 'session-1', text: 'Yes', orderIndex: 0 };
const baseEligibility = {
  id: 'elig-1',
  sessionId: 'session-1',
  memberId: 'member-1',
  isEligible: true,
  votingWeight: '1.0',
  canDelegate: true,
  delegatedTo: null,
};

/* ── tests ──────────────────────────────────────────────────────────── */

describe('VotingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReset();
    mocks.mockSessionsFindFirst.mockResolvedValue(baseSession);
    mocks.mockVotesFindFirst.mockResolvedValue(null);
    mocks.mockEligibilityFindFirst.mockResolvedValue(baseEligibility);
    mocks.mockInsertReturning.mockResolvedValue([{ id: 'new-1' }]);
    mocks.mockUpdateReturning.mockResolvedValue([baseSession]);
    mocks.mockDeleteWhere.mockResolvedValue(undefined);
    mocks.mockSelect.mockReturnValue(chain([]));
  });

  // ── getVotingSessionById ──────────────────────────────────────────
  describe('getVotingSessionById', () => {
    it('returns null when not found', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue(null);
      expect(await getVotingSessionById('x')).toBeNull();
    });

    it('returns session without options', async () => {
      const r = await getVotingSessionById('session-1');
      expect(r).toEqual(baseSession);
    });

    it('includes options when requested', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([baseOption]))        // votingOptions
        .mockReturnValueOnce(chain([{ count: 5 }]));     // vote count
      const r = await getVotingSessionById('session-1', true);
      expect(r?.options).toEqual([baseOption]);
      expect(r?.voteCount).toBe(5);
    });

    it('throws on db error', async () => {
      mocks.mockSessionsFindFirst.mockRejectedValue(new Error('DB'));
      await expect(getVotingSessionById('x')).rejects.toThrow('Failed to fetch');
    });
  });

  // ── listVotingSessions ────────────────────────────────────────────
  describe('listVotingSessions', () => {
    it('returns paginated sessions', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 2 }]))
        .mockReturnValueOnce(chain([baseSession]));
      const r = await listVotingSessions({}, { page: 1, limit: 10 });
      expect(r.total).toBe(2);
      expect(r.sessions).toEqual([baseSession]);
      expect(r.page).toBe(1);
    });

    it('falls back to 0 when count is missing', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{}]))
        .mockReturnValueOnce(chain([]));
      const r = await listVotingSessions({});
      expect(r.total).toBe(0);
    });

    it('applies filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([baseSession]));
      const r = await listVotingSessions({ organizationId: 'org-1', status: ['active'] });
      expect(r.total).toBe(1);
    });

    it('applies type and date range filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 2 }]))
        .mockReturnValueOnce(chain([baseSession]));
      const r = await listVotingSessions({
        type: 'election',
        startDateFrom: new Date('2026-01-01'),
        startDateTo: new Date('2026-12-31'),
      });
      expect(r.total).toBe(2);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('DB'); });
      await expect(listVotingSessions()).rejects.toThrow('Failed to list');
    });
  });

  // ── createVotingSession ───────────────────────────────────────────
  describe('createVotingSession', () => {
    it('inserts and returns session', async () => {
      mocks.mockInsertReturning.mockResolvedValue([baseSession]);
      const r = await createVotingSession(baseSession as never);
      expect(r).toEqual(baseSession);
    });

    it('throws on error', async () => {
      mocks.mockInsertReturning.mockRejectedValue(new Error('constraint'));
      await expect(createVotingSession({} as never)).rejects.toThrow('Failed to create');
    });
  });

  // ── updateVotingSession ───────────────────────────────────────────
  describe('updateVotingSession', () => {
    it('updates and returns session', async () => {
      const updated = { ...baseSession, title: 'New Title' };
      mocks.mockUpdateReturning.mockResolvedValue([updated]);
      const r = await updateVotingSession('session-1', { title: 'New Title' } as never);
      expect(r?.title).toBe('New Title');
    });

    it('returns null when not found', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([undefined]);
      expect(await updateVotingSession('x', {} as never)).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockUpdateReturning.mockRejectedValue(new Error('DB'));
      await expect(updateVotingSession('x', {} as never)).rejects.toThrow('Failed to update');
    });
  });

  // ── deleteVotingSession ───────────────────────────────────────────
  describe('deleteVotingSession', () => {
    it('deletes and returns true', async () => {
      expect(await deleteVotingSession('session-1')).toBe(true);
    });

    it('throws on error', async () => {
      mocks.mockDeleteWhere.mockRejectedValue(new Error('DB'));
      await expect(deleteVotingSession('x')).rejects.toThrow('Failed to delete');
    });
  });

  // ── addVotingOption ───────────────────────────────────────────────
  describe('addVotingOption', () => {
    it('inserts and returns option', async () => {
      mocks.mockInsertReturning.mockResolvedValue([baseOption]);
      const r = await addVotingOption(baseOption as never);
      expect(r.id).toBe('opt-1');
    });

    it('throws on error', async () => {
      mocks.mockInsertReturning.mockRejectedValue(new Error('DB'));
      await expect(addVotingOption({} as never)).rejects.toThrow('Failed to add voting option');
    });
  });

  // ── updateVotingOption ────────────────────────────────────────────
  describe('updateVotingOption', () => {
    it('updates and returns option', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([{ ...baseOption, text: 'No' }]);
      const r = await updateVotingOption('opt-1', { text: 'No' } as never);
      expect(r?.text).toBe('No');
    });

    it('returns null when not found', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([undefined]);
      expect(await updateVotingOption('x', {} as never)).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockUpdateReturning.mockRejectedValue(new Error('DB'));
      await expect(updateVotingOption('x', {} as never)).rejects.toThrow('Failed to update voting option');
    });
  });

  // ── deleteVotingOption ────────────────────────────────────────────
  describe('deleteVotingOption', () => {
    it('deletes and returns true', async () => {
      expect(await deleteVotingOption('opt-1')).toBe(true);
    });

    it('throws on error', async () => {
      mocks.mockDeleteWhere.mockRejectedValue(new Error('DB'));
      await expect(deleteVotingOption('opt-1')).rejects.toThrow('Failed to delete voting option');
    });
  });

  // ── addVoterEligibility ───────────────────────────────────────────
  describe('addVoterEligibility', () => {
    it('inserts and returns eligibility', async () => {
      mocks.mockInsertReturning.mockResolvedValue([baseEligibility]);
      const r = await addVoterEligibility(baseEligibility as never);
      expect(r.memberId).toBe('member-1');
    });

    it('throws on error', async () => {
      mocks.mockInsertReturning.mockRejectedValue(new Error('DB'));
      await expect(addVoterEligibility(baseEligibility as never)).rejects.toThrow('Failed to add voter eligibility');
    });
  });

  // ── bulkAddVoterEligibility ───────────────────────────────────────
  describe('bulkAddVoterEligibility', () => {
    it('inserts multiple and returns count', async () => {
      mocks.mockInsertReturning.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);
      const count = await bulkAddVoterEligibility('session-1', ['m1', 'm2', 'm3']);
      expect(count).toBe(3);
    });

    it('throws on error', async () => {
      mocks.mockInsertReturning.mockRejectedValue(new Error('DB'));
      await expect(bulkAddVoterEligibility('s', ['m'])).rejects.toThrow('Failed to bulk add');
    });
  });

  // ── checkVoterEligibility ─────────────────────────────────────────
  describe('checkVoterEligibility', () => {
    it('returns eligibility record', async () => {
      const r = await checkVoterEligibility('session-1', 'member-1');
      expect(r?.isEligible).toBe(true);
    });

    it('returns null when not found', async () => {
      mocks.mockEligibilityFindFirst.mockResolvedValue(null);
      expect(await checkVoterEligibility('s', 'm')).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockEligibilityFindFirst.mockRejectedValue(new Error('DB'));
      await expect(checkVoterEligibility('s', 'm')).rejects.toThrow('Failed to check');
    });
  });

  // ── updateVoterEligibility ────────────────────────────────────────
  describe('updateVoterEligibility', () => {
    it('updates and returns record', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([{ ...baseEligibility, isEligible: false }]);
      const r = await updateVoterEligibility('elig-1', { isEligible: false } as never);
      expect(r?.isEligible).toBe(false);
    });

    it('returns null when not found', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([undefined]);
      expect(await updateVoterEligibility('x', {} as never)).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockUpdateReturning.mockRejectedValue(new Error('DB'));
      await expect(updateVoterEligibility('x', {} as never)).rejects.toThrow('Failed to update voter eligibility');
    });
  });

  // ── castVote ──────────────────────────────────────────────────────
  describe('castVote', () => {
    it('casts vote for eligible voter', async () => {
      const vote = { id: 'vote-1', sessionId: 'session-1', optionId: 'opt-1' };
      mocks.mockInsertReturning.mockResolvedValue([vote]);
      const r = await castVote('session-1', 'opt-1', 'member-1');
      expect(r.id).toBe('vote-1');
    });

    it('throws when voter not eligible', async () => {
      mocks.mockEligibilityFindFirst.mockResolvedValue(null);
      await expect(castVote('s', 'o', 'm')).rejects.toThrow('not eligible');
    });

    it('throws when already voted', async () => {
      mocks.mockVotesFindFirst.mockResolvedValue({ id: 'existing' });
      await expect(castVote('session-1', 'opt-1', 'member-1')).rejects.toThrow('already cast');
    });

    it('supports non-anonymous voting', async () => {
      const vote = { id: 'vote-1', voterId: 'member-1' };
      mocks.mockInsertReturning.mockResolvedValue([vote]);
      const r = await castVote('session-1', 'opt-1', 'member-1', false);
      expect(r.id).toBe('vote-1');
    });

    it('throws when VOTING_SECRET is not configured', async () => {
      vi.doMock('@/lib/config/env-validation', () => ({ env: { VOTING_SECRET: undefined } }));
      vi.resetModules();
      const { castVote: freshCastVote } = await import('../voting-service');
      await expect(freshCastVote('s', 'o', 'm')).rejects.toThrow();
      vi.doUnmock('@/lib/config/env-validation');
      vi.resetModules();
    });

    it('throws when VOTING_SECRET is too short', async () => {
      vi.doMock('@/lib/config/env-validation', () => ({ env: { VOTING_SECRET: 'short' } }));
      vi.resetModules();
      const { castVote: freshCastVote } = await import('../voting-service');
      await expect(freshCastVote('s', 'o', 'm')).rejects.toThrow();
      vi.doUnmock('@/lib/config/env-validation');
      vi.resetModules();
    });

    it('throws generic failure when non-Error is thrown internally', async () => {
      mocks.mockInsertReturning.mockRejectedValue('boom');
      await expect(castVote('session-1', 'opt-1', 'member-1')).rejects.toThrow('Failed to cast vote');
    });
  });

  // ── hasVoted ──────────────────────────────────────────────────────
  describe('hasVoted', () => {
    it('returns true when vote exists', async () => {
      mocks.mockVotesFindFirst.mockResolvedValue({ id: 'v1' });
      expect(await hasVoted('session-1', 'member-1')).toBe(true);
    });

    it('returns false when no vote', async () => {
      expect(await hasVoted('session-1', 'member-1')).toBe(false);
    });

    it('returns false on error', async () => {
      mocks.mockVotesFindFirst.mockRejectedValue(new Error('fail'));
      expect(await hasVoted('s', 'm')).toBe(false);
    });
  });

  // ── calculateResults ──────────────────────────────────────────────
  describe('calculateResults', () => {
    it('calculates results with quorum check', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue(baseSession);
      mocks.mockSelect
        .mockReturnValueOnce(chain([baseOption, { ...baseOption, id: 'opt-2', text: 'No' }])) // options
        .mockReturnValueOnce(chain([{ count: 60 }]))   // total votes for session
        .mockReturnValueOnce(chain([                     // vote counts per option
          { optionId: 'opt-1', count: 40 },
          { optionId: 'opt-2', count: 20 },
        ]));
      const r = await calculateResults('session-1');
      expect(r.totalVotes).toBe(60);
      expect(r.options[0].voteCount).toBe(40);
      expect(r.quorumMet).toBe(true);
      expect(r.winner).toBe('opt-1');
    });

    it('marks quorum as met when the session does not require quorum', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, requiresQuorum: false, totalEligibleVoters: 0 });
      mocks.mockSelect
        .mockReturnValueOnce(chain([baseOption]))
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([{ optionId: 'opt-1', count: 0 }]));

      const r = await calculateResults('session-1');
      expect(r.quorumMet).toBe(true);
      expect(r.turnoutPercentage).toBe(0);
    });

    it('throws when session not found', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue(null);
      await expect(calculateResults('x')).rejects.toThrow('Failed to calculate');
    });

    it('marks quorum unmet when turnout is below threshold', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, requiresQuorum: true, quorumThreshold: 80, totalEligibleVoters: 100 });
      mocks.mockSelect
        .mockReturnValueOnce(chain([baseOption]))
        .mockReturnValueOnce(chain([{ count: 50 }]))
        .mockReturnValueOnce(chain([{ optionId: 'opt-1', count: 50 }]));

      const r = await calculateResults('session-1');
      expect(r.quorumMet).toBe(false);
      expect(r.turnoutPercentage).toBe(50);
    });

    it('handles missing options and defaults quorum threshold to 50', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, requiresQuorum: true, quorumThreshold: undefined, totalEligibleVoters: 100 });
      mocks.mockSelect
        .mockReturnValueOnce(chain(null))
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([{ optionId: 'opt-1', count: 60 }]));

      const r = await calculateResults('session-1');
      expect(r.options).toEqual([]);
      expect(r.quorumMet).toBe(true);
    });

    it('computes zero percentage for options that have no votes in a non-zero total', async () => {
      const options = [
        { id: 'opt-1', text: 'Yes', orderIndex: 0 },
        { id: 'opt-2', text: 'No', orderIndex: 1 },
      ];
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options, totalEligibleVoters: 100 });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 40 }]))
        .mockReturnValueOnce(chain([{ optionId: 'opt-1', count: 40 }]));

      const r = await calculateResults('session-1');
      expect(r.options.find((o) => o.optionId === 'opt-2')?.percentage).toBe(0);
    });
  });

  // ── calculateRankedChoiceResults ──────────────────────────────────
  describe('calculateRankedChoiceResults', () => {
    it('calculates IRV results', async () => {
      const options = [
        { id: 'a', text: 'Alice', orderIndex: 0 },
        { id: 'b', text: 'Bob', orderIndex: 1 },
      ];
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))         // options
        .mockReturnValueOnce(chain([{ count: 3 }]))  // total votes
        .mockReturnValueOnce(chain([                  // ranked votes
          { optionId: 'a', voterMetadata: { preferences: ['a', 'b'] } },
          { optionId: 'a', voterMetadata: { preferences: ['a', 'b'] } },
          { optionId: 'b', voterMetadata: { preferences: ['b', 'a'] } },
        ]));
      const r = await calculateRankedChoiceResults('session-1');
      expect(r.winner).toBe('Alice');
      expect(r.rounds.length).toBeGreaterThanOrEqual(1);
    });

    it('runs elimination rounds until a winner emerges', async () => {
      const options = [
        { id: 'a', text: 'Alice', orderIndex: 0 },
        { id: 'b', text: 'Bob', orderIndex: 1 },
        { id: 'c', text: 'Carol', orderIndex: 2 },
      ];
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 3 }]))
        .mockReturnValueOnce(chain([
          { optionId: 'a', voterMetadata: { preferences: ['a', 'b', 'c'] } },
          { optionId: 'b', voterMetadata: { preferences: ['b', 'c', 'a'] } },
          { optionId: 'c', voterMetadata: { preferences: ['c', 'b', 'a'] } },
        ]));

      const r = await calculateRankedChoiceResults('session-1');
      expect(r.rounds.length).toBeGreaterThanOrEqual(2);
      expect(r.winner).toBe('Bob');
      expect(r.runnerUp).toBe('Carol');
    });

    it('throws when no votes', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([baseOption]))      // options
        .mockReturnValueOnce(chain([{ count: 0 }]))    // total votes count
        .mockReturnValueOnce(chain([]));               // no votes
      await expect(calculateRankedChoiceResults('session-1')).rejects.toThrow('Failed to calculate');
    });

    it('throws when session not found', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue(null);
      await expect(calculateRankedChoiceResults('session-1')).rejects.toThrow('Failed to calculate');
    });

    it('handles votes without preferences (falls back to optionId)', async () => {
      const options = [
        { id: 'a', text: 'Alice', orderIndex: 0 },
        { id: 'b', text: 'Bob', orderIndex: 1 },
      ];
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 3 }]))
        .mockReturnValueOnce(chain([
          { optionId: 'a', voterMetadata: null },
          { optionId: 'a', voterMetadata: null },
          { optionId: 'b', voterMetadata: { preferences: ['x', 'y'] } }, // all prefs inactive after elimination
        ]));

      const r = await calculateRankedChoiceResults('session-1');
      expect(r.winner).toBe('Alice');
    });

    it('exits loop naturally when options eliminate down to one winner', async () => {
      const options = [
        { id: 'a', text: 'Alpha', orderIndex: 0 },
        { id: 'b', text: 'Beta', orderIndex: 1 },
      ];
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 2 }]))
        .mockReturnValueOnce(chain([
          // Perfectly split — a voter votes only for 'a', b voter votes only for 'b'
          { optionId: 'a', voterMetadata: { preferences: ['a'] } },
          { optionId: 'b', voterMetadata: { preferences: ['b'] } },
        ]));

      const r = await calculateRankedChoiceResults('session-1');
      // One option is eliminated, the remaining option is returned via the exit-loop path
      expect(['Alpha', 'Beta']).toContain(r.winner);
    });

    it('returns empty winner when session has no options', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession });
      mocks.mockSelect
        .mockReturnValueOnce(chain(null))
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([{ optionId: 'a', voterMetadata: null }]));

      const r = await calculateRankedChoiceResults('session-1');
      expect(r.winner).toBe('');
      expect(r.runnerUp).toBe('');
    });

    it('falls back to eliminated option id when eliminated option has no text', async () => {
      const options = [
        { id: 'a', text: 'Alpha', orderIndex: 0 },
        { id: 'c', orderIndex: 1 },
        { id: 'b', text: 'Beta', orderIndex: 2 },
      ] as never;
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 4 }]))
        .mockReturnValueOnce(chain([
          { optionId: 'a', voterMetadata: { preferences: ['a', 'c', 'b'] } },
          { optionId: 'a', voterMetadata: { preferences: ['a', 'c', 'b'] } },
          { optionId: 'b', voterMetadata: { preferences: ['b', 'a', 'c'] } },
          { optionId: 'c', voterMetadata: { preferences: ['c', 'a', 'b'] } },
        ]));

      const r = await calculateRankedChoiceResults('session-1');
      expect(r.rounds[0]?.eliminated).toBe('c');
    });

    it('falls back to option id when option text is missing', async () => {
      const options = [
        { id: 'a', orderIndex: 0 },
        { id: 'b', orderIndex: 1 },
      ] as never;
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: 3 }]))
        .mockReturnValueOnce(chain([
          { optionId: 'a', voterMetadata: { preferences: ['a', 'b'] } },
          { optionId: 'b', voterMetadata: { preferences: ['b', 'a'] } },
          { optionId: 'a', voterMetadata: { preferences: ['a', 'b'] } },
        ]));

      const r = await calculateRankedChoiceResults('session-1');
      expect(typeof r.winner).toBe('string');
    });

    it('triggers IRV safety check after >50 rounds', async () => {
      const options = Array.from({ length: 51 }, (_, i) => ({ id: `o${i}`, text: `Opt ${i}`, orderIndex: i }));
      const votes = options.map((o) => ({ optionId: o.id, voterMetadata: { preferences: [o.id] } }));
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, options });
      mocks.mockSelect
        .mockReturnValueOnce(chain(options))
        .mockReturnValueOnce(chain([{ count: votes.length }]))
        .mockReturnValueOnce(chain(votes));

      const r = await calculateRankedChoiceResults('session-1');
      expect(r.rounds.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── setProxyVoter ─────────────────────────────────────────────────
  describe('setProxyVoter', () => {
    it('sets proxy', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([{ ...baseEligibility, delegatedTo: 'member-2' }]);
      const r = await setProxyVoter('session-1', 'member-1', 'member-2');
      expect(r?.delegatedTo).toBe('member-2');
    });

    it('throws when not eligible', async () => {
      mocks.mockEligibilityFindFirst.mockResolvedValue(null);
      await expect(setProxyVoter('s', 'm', 'p')).rejects.toThrow('Failed to set proxy voter');
    });

    it('throws when cannot delegate', async () => {
      mocks.mockEligibilityFindFirst.mockResolvedValue({ ...baseEligibility, canDelegate: false });
      await expect(setProxyVoter('s', 'm', 'p')).rejects.toThrow('Failed to set proxy voter');
    });
  });

  // ── removeProxyVoter ──────────────────────────────────────────────
  describe('removeProxyVoter', () => {
    it('removes proxy', async () => {
      mocks.mockUpdateReturning.mockResolvedValue([{ ...baseEligibility, delegatedTo: null }]);
      const r = await removeProxyVoter('session-1', 'member-1');
      expect(r?.delegatedTo).toBeNull();
    });

    it('throws when not found', async () => {
      mocks.mockEligibilityFindFirst.mockResolvedValue(null);
      await expect(removeProxyVoter('s', 'm')).rejects.toThrow('Failed to remove proxy voter');
    });
  });

  // ── getSessionStatistics ──────────────────────────────────────────
  describe('getSessionStatistics', () => {
    it('returns statistics', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 60 }]))  // totalVoted
        .mockReturnValueOnce(chain([                   // allVotes
          { castAt: new Date('2025-06-01T10:00:00') },
          { castAt: new Date('2025-06-01T10:30:00') },
          { castAt: new Date('2025-06-01T11:00:00') },
        ]));
      const r = await getSessionStatistics('session-1');
      expect(r.totalEligible).toBe(100);
      expect(r.totalVoted).toBe(60);
      expect(r.turnoutPercentage).toBe(60);
      expect(r.votesByHour).toBeDefined();
    });

    it('returns zero turnout when no eligible voters exist', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue({ ...baseSession, totalEligibleVoters: 0 });
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const r = await getSessionStatistics('session-1');
      expect(r.turnoutPercentage).toBe(0);
      expect(r.totalVoted).toBe(0);
    });

    it('throws when session not found', async () => {
      mocks.mockSessionsFindFirst.mockResolvedValue(null);
      await expect(getSessionStatistics('x')).rejects.toThrow('Failed to get');
    });

    it('skips votes without castAt in hour bucketing', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 2 }]))
        .mockReturnValueOnce(chain([
          { castAt: new Date('2025-06-01T10:00:00') },
          { castAt: null },
        ]));
      const r = await getSessionStatistics('session-1');
      expect(Object.keys(r.votesByHour)).toHaveLength(1);
    });
  });
});
