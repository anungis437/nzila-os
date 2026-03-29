import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockFindFirst: vi.fn(),
  mockWithRLS: vi.fn(),
  mockGetProtocol: vi.fn(),
  mockGetPrimaryRole: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockReturnValue({
        returning: mocks.mockReturning,
      }),
    }),
    update: mocks.mockUpdate.mockReturnValue({
      set: mocks.mockSet.mockReturnValue({
        where: mocks.mockWhere.mockResolvedValue(undefined),
      }),
    }),
    query: {
      claims: { findFirst: mocks.mockFindFirst },
      grievanceAssignments: { findFirst: mocks.mockFindFirst },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  claims: { claimId: 'claimId', organizationId: 'organizationId', assignedTo: 'assignedTo', assignedAt: 'assignedAt' },
  grievanceAssignments: {
    claimId: 'claimId',
    assignedTo: 'assignedTo',
    status: 'status',
    $inferInsert: { role: '' },
  },
  organizationMembers: { organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.mockWithRLS.mockImplementation(
    (_opts: unknown, fn: (db: unknown) => unknown) => {
      // Pass a mock db with query support
      return fn({
        query: {
          claims: { findFirst: mocks.mockFindFirst },
          grievanceAssignments: { findFirst: mocks.mockFindFirst },
        },
        insert: mocks.mockInsert.mockReturnValue({
          values: mocks.mockValues.mockReturnValue({
            returning: mocks.mockReturning,
          }),
        }),
      });
    }
  ),
}));

vi.mock('@/lib/representation', () => ({
  getRepresentationProtocol: mocks.mockGetProtocol.mockResolvedValue('standard'),
  getPrimaryAssignmentRole: mocks.mockGetPrimaryRole.mockReturnValue('primary_officer'),
}));

import { autoAssignGrievance } from '../case-assignment-engine';

describe('case-assignment-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when claim not found', async () => {
    mocks.mockFindFirst.mockResolvedValue(null);

    const result = await autoAssignGrievance(
      'claim-1',
      'org-1',
      {},
      'admin'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Claim not found');
  });

  it('returns error when no eligible officers', async () => {
    mocks.mockFindFirst.mockResolvedValueOnce({
      claimId: 'claim-1',
      status: 'open',
      claimType: 'grievance',
    });

    // withRLSContext for getEligibleOfficers will also call through
    // The function internally queries for officers — the mock returns empty
    mocks.mockWithRLS.mockImplementation(
      (_opts: unknown, fn: (db: unknown) => unknown) => {
        return fn({
          query: {
            claims: { findFirst: vi.fn().mockResolvedValue({ claimId: 'claim-1' }) },
            organizationMembers: { findMany: vi.fn().mockResolvedValue([]) },
            grievanceAssignments: { findFirst: vi.fn().mockResolvedValue(null) },
          },
        });
      }
    );

    const result = await autoAssignGrievance(
      'claim-1',
      'org-1',
      {},
      'admin'
    );

    // Should fail since no officers found
    expect(result.success).toBe(false);
  });

  it('handles thrown errors gracefully', async () => {
    mocks.mockGetProtocol.mockRejectedValue(new Error('DB error'));

    const result = await autoAssignGrievance(
      'claim-1',
      'org-1',
      {},
      'admin'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });
});
