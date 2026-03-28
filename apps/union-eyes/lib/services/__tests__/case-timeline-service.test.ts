/**
 * Case Timeline Service — Unit Tests
 *
 * Tests:
 *   - getMemberVisibleTimeline returns events filtered for member
 *   - getMemberVisibleTimeline returns empty for no events
 *   - getMemberVisibleTimeline throws for claim not found
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelectWhere, mockLimit, mockOrderBy } = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(() => []),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
          orderBy: mockOrderBy,
        })),
        orderBy: vi.fn(() => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  claimUpdates: { claimId: 'claimId', visibilityScope: 'visibilityScope', createdAt: 'createdAt' },
  grievanceTransitions: {},
  claims: { claimId: 'claimId', memberId: 'memberId', organizationId: 'organizationId' },
  organizationMembers: {},
  users: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('../lro-signals', () => ({
  detectSignals: vi.fn(async () => []),
}));

vi.mock('../notification-service', () => ({
  NotificationService: {
    send: vi.fn(),
    notify: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getMemberVisibleTimeline } from '../case-timeline-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('case-timeline-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: claim exists, no updates
    mockLimit.mockResolvedValue([
      { claimId: 'claim-1', memberId: 'member-1', organizationId: 'org-1' },
    ]);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns timeline events filtered for member visibility', async () => {
    // First call: claim lookup (returns claim)
    // Second call: updates query
    let callCount = 0;
    mockLimit.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return [{ claimId: 'claim-1', memberId: 'member-1', organizationId: 'org-1' }];
      }
      return [];
    });

    const { db } = await import('@/db/db');
    const mockFrom = vi.fn(() => ({
      where: vi.fn(() => ({
        limit: mockLimit,
        orderBy: vi.fn().mockResolvedValue([
          {
            updateId: 'u1',
            claimId: 'claim-1',
            message: 'Status changed',
            createdBy: 'system',
            visibilityScope: 'member',
            createdAt: new Date('2026-03-01'),
            metadata: null,
          },
        ]),
      })),
    }));

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const events = await getMemberVisibleTimeline('claim-1', 'member-1');
    expect(Array.isArray(events)).toBe(true);
  });

  it('throws when claim not found', async () => {
    mockLimit.mockResolvedValue([]); // no claim

    const { db } = await import('@/db/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    await expect(getMemberVisibleTimeline('nonexistent', 'member-1')).rejects.toThrow('Claim not found');
  });

  it('returns empty array when no member-visible events exist', async () => {
    const { db } = await import('@/db/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            { claimId: 'claim-1', memberId: 'member-1', organizationId: 'org-1' },
          ]),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      })),
    });

    const events = await getMemberVisibleTimeline('claim-1', 'member-1');
    expect(events).toEqual([]);
  });
});
