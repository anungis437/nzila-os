import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ─────────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockWithRLS: vi.fn(),
  mockValidateTransition: vi.fn(),
  mockGetAllowedTransitions: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      submitted: ['under_review', 'assigned', 'rejected'],
      under_review: ['investigation', 'pending_documentation', 'resolved', 'rejected', 'assigned'],
    };
    return map[status] || [];
  }),
  mockDetectSignals: vi.fn(),
  mockGenerateDefPack: vi.fn(),
  mockAddTimeline: vi.fn(),
  mockEventBusEmit: vi.fn(),
  mockSendNotification: vi.fn(),
  mockCreateSatisfactionSurvey: vi.fn(),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

/* ── module mocks ──────────────────────────────────────────────────────────── */
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: (...a: unknown[]) => mocks.mockSelect(...a),
    update: (...a: unknown[]) => mocks.mockUpdate(...a),
    insert: (...a: unknown[]) => mocks.mockInsert(...a),
  },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (...a: unknown[]) => mocks.mockWithRLS(...a),
}));

vi.mock('@/db/schema/claims-schema', () => ({
  claims: {}, claimUpdates: {},
}));
vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: {},
}));
vi.mock('@/db/schema/user-management-schema', () => ({
  users: {},
}));
vi.mock('@/lib/claim-notifications', () => ({
  sendClaimStatusNotification: (...a: unknown[]) => mocks.mockSendNotification(...a),
}));
vi.mock('@/lib/services/claim-workflow-fsm', () => ({
  validateClaimTransition: (...a: unknown[]) => mocks.mockValidateTransition(...a),
  getAllowedClaimTransitions: (...a: unknown[]) => mocks.mockGetAllowedTransitions(...a),
}));
vi.mock('@/lib/services/lro-signals', () => ({
  detectAllSignals: (...a: unknown[]) => mocks.mockDetectSignals(...a),
}));
vi.mock('@/lib/services/defensibility-pack', () => ({
  generateDefensibilityPack: (...a: unknown[]) => mocks.mockGenerateDefPack(...a),
}));
vi.mock('@/db/schema/defensibility-packs-schema', () => ({
  defensibilityPacks: {},
}));
vi.mock('@/lib/integrations/timeline-integration', () => ({
  addTimelineEntry: (...a: unknown[]) => mocks.mockAddTimeline(...a),
}));
vi.mock('@/lib/events/event-bus', () => ({
  eventBus: { emit: (...a: unknown[]) => mocks.mockEventBusEmit(...a), on: vi.fn() },
}));
vi.mock('@/lib/services/satisfaction-service', () => ({
  createSatisfactionSurvey: (...a: unknown[]) => mocks.mockCreateSatisfactionSurvey(...a),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), relations: vi.fn(() => ({})),
}));

/* ── imports ───────────────────────────────────────────────────────────────── */
import {
  isValidTransition,
  getAllowedTransitions,
  calculateDeadline,
  isClaimOverdue,
  getDaysUntilDeadline,
  getClaimWorkflowStatus,
  updateClaimStatus,
  assignClaim,
  getOverdueClaims,
  getClaimsApproachingDeadline,
  addClaimNote,
  STATUS_TRANSITIONS,
  STATUS_DEADLINES,
  PRIORITY_MULTIPLIERS,
} from '../workflow-engine';

/* ── tests ─────────────────────────────────────────────────────────────────── */
describe('workflow-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSendNotification.mockResolvedValue(undefined);
    mocks.mockAddTimeline.mockResolvedValue(undefined);
    mocks.mockUpdate.mockReturnValue(chain(undefined));
    mocks.mockInsert.mockReturnValue(chain(undefined));
  });

  // ── Constants ─────────────────────────────────────────────────────────────
  describe('STATUS_TRANSITIONS', () => {
    it('defines transitions for all expected statuses', () => {
      expect(STATUS_TRANSITIONS).toHaveProperty('submitted');
      expect(STATUS_TRANSITIONS).toHaveProperty('closed');
      expect(STATUS_TRANSITIONS.closed).toEqual([]);
    });
  });

  describe('STATUS_DEADLINES', () => {
    it('defines SLA days for key statuses', () => {
      expect(STATUS_DEADLINES.submitted).toBe(2);
      expect(STATUS_DEADLINES.investigation).toBe(10);
      expect(STATUS_DEADLINES.closed).toBe(0);
    });
  });

  describe('PRIORITY_MULTIPLIERS', () => {
    it('defines multipliers', () => {
      expect(PRIORITY_MULTIPLIERS.critical).toBe(0.5);
      expect(PRIORITY_MULTIPLIERS.medium).toBe(1.0);
      expect(PRIORITY_MULTIPLIERS.low).toBe(1.5);
    });
  });

  // ── Pure functions ────────────────────────────────────────────────────────
  describe('isValidTransition', () => {
    it('returns true for valid transition', () => {
      expect(isValidTransition('submitted', 'under_review')).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(isValidTransition('submitted', 'closed')).toBe(false);
    });

    it('returns false for transitions from closed (terminal)', () => {
      expect(isValidTransition('closed', 'submitted')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns transitions for a status', () => {
      const transitions = getAllowedTransitions('submitted');
      expect(transitions).toContain('under_review');
    });

    it('delegates to FSM when userRole provided', () => {
      getAllowedTransitions('submitted', 'steward');
      expect(mocks.mockGetAllowedTransitions).toHaveBeenCalledWith('submitted', 'steward');
    });
  });

  describe('calculateDeadline', () => {
    it('calculates deadline based on status and priority', () => {
      const fromDate = new Date('2026-03-01T00:00:00Z');
      const deadline = calculateDeadline('submitted', 'medium', fromDate);
      expect(deadline.getTime()).toBe(new Date('2026-03-03T00:00:00Z').getTime());
    });

    it('applies priority multiplier for critical', () => {
      const fromDate = new Date('2026-03-01T00:00:00Z');
      const deadline = calculateDeadline('investigation', 'critical', fromDate);
      expect(deadline.getTime()).toBe(new Date('2026-03-06T00:00:00Z').getTime());
    });
  });

  describe('isClaimOverdue', () => {
    it('returns true when past deadline', () => {
      expect(isClaimOverdue('submitted', 'medium', new Date('2025-01-01'))).toBe(true);
    });

    it('returns false when before deadline', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30);
      expect(isClaimOverdue('submitted', 'medium', futureDate)).toBe(false);
    });
  });

  describe('getDaysUntilDeadline', () => {
    it('returns positive days when before deadline', () => {
      const recentDate = new Date(Date.now() - 86400000);
      const days = getDaysUntilDeadline('investigation', 'medium', recentDate);
      expect(days).toBeGreaterThan(0);
    });

    it('returns negative days when past deadline', () => {
      const days = getDaysUntilDeadline('submitted', 'medium', new Date('2025-01-01'));
      expect(days).toBeLessThan(0);
    });
  });

  // ── getClaimWorkflowStatus ────────────────────────────────────────────────
  describe('getClaimWorkflowStatus', () => {
    it('returns workflow info for a claim', () => {
      const claim = { status: 'submitted', priority: 'medium', updatedAt: new Date(), progress: 10 };
      const result = getClaimWorkflowStatus(claim);
      expect(result.currentStatus).toBe('submitted');
      expect(result.priority).toBe('medium');
      expect(result.allowedTransitions).toContain('under_review');
      expect(result.progress).toBe(10);
    });

    it('uses createdAt when updatedAt is missing', () => {
      const createdAt = new Date('2026-03-01');
      const result = getClaimWorkflowStatus({
        status: 'investigation', priority: 'high', updatedAt: null, createdAt, progress: 50,
      });
      expect(result.statusSince).toBe(createdAt);
    });
  });

  // ── assignClaim ───────────────────────────────────────────────────────────
  describe('assignClaim', () => {
    it('assigns claim to steward', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([{ claimId: 'c1', status: 'submitted' }]));
      mocks.mockUpdate.mockReturnValueOnce(chain(undefined));
      mocks.mockInsert.mockReturnValueOnce(chain(undefined));
      const result = await assignClaim('c1', 'steward1', 'admin1');
      expect(result).toEqual({ success: true });
    });

    it('returns error when claim not found', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([]));
      const result = await assignClaim('missing', 's1', 'a1');
      expect(result).toEqual({ success: false, error: 'Claim not found' });
    });

    it('returns error on db failure', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('DB fail'); });
      const result = await assignClaim('c1', 's1', 'a1');
      expect(result).toEqual({ success: false, error: 'DB fail' });
    });
  });

  // ── getOverdueClaims ──────────────────────────────────────────────────────
  describe('getOverdueClaims', () => {
    it('filters overdue claims', async () => {
      const pastDate = new Date('2024-01-01');
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'submitted', priority: 'medium', updatedAt: pastDate, createdAt: pastDate },
        { status: 'closed', priority: 'medium', updatedAt: pastDate, createdAt: pastDate },
      ]));
      const result = await getOverdueClaims();
      expect(result).toHaveLength(1);
    });

    it('returns empty on error', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('fail'); });
      const result = await getOverdueClaims();
      expect(result).toEqual([]);
    });

    it('skips claims with no dates', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'submitted', priority: 'medium', updatedAt: null, createdAt: null },
      ]));
      const result = await getOverdueClaims();
      expect(result).toHaveLength(0);
    });
  });

  // ── getClaimsApproachingDeadline ──────────────────────────────────────────
  describe('getClaimsApproachingDeadline', () => {
    it('filters claims within 1 day of deadline', async () => {
      // investigation = 10 days × medium 1.0 → deadline in 10 days from statusDate
      // Need a date ~9 days ago so daysRemaining ≤ 1
      const nineDaysAgo = new Date(Date.now() - 86400000 * 9);
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'investigation', priority: 'medium', updatedAt: nineDaysAgo, createdAt: nineDaysAgo },
        { status: 'closed', priority: 'medium', updatedAt: nineDaysAgo, createdAt: nineDaysAgo },
      ]));
      const result = await getClaimsApproachingDeadline();
      expect(result).toHaveLength(1);
    });

    it('returns empty on error', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('fail'); });
      const result = await getClaimsApproachingDeadline();
      expect(result).toEqual([]);
    });
  });

  // ── addClaimNote ──────────────────────────────────────────────────────────
  describe('addClaimNote', () => {
    it('adds note when tx provided', async () => {
      const mockTx = {
        select: vi.fn(() => chain([{ claimId: 'c1', claimNumber: 'CLM-001' }])),
        insert: vi.fn(() => chain(undefined)),
        update: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await addClaimNote('CLM-001', 'Test note', 'user1', true, mockTx as any);
      expect(result).toEqual({ success: true });
    });

    it('returns error when claim not found', async () => {
      const mockTx = {
        select: vi.fn(() => chain([])),
        insert: vi.fn(() => chain(undefined)),
        update: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await addClaimNote('MISSING', 'msg', 'u1', true, mockTx as any);
      expect(result).toEqual({ success: false, error: 'Claim not found' });
    });

    it('wraps in RLS context when no tx', async () => {
      mocks.mockWithRLS.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        const mockTx = {
          select: vi.fn(() => chain([{ claimId: 'c1', claimNumber: 'CLM-001' }])),
          insert: vi.fn(() => chain(undefined)),
          update: vi.fn(() => chain(undefined)),
        };
        return fn(mockTx);
      });
      const result = await addClaimNote('CLM-001', 'Note', 'user1');
      expect(result).toEqual({ success: true });
      expect(mocks.mockWithRLS).toHaveBeenCalled();
    });

    it('returns error on db failure', async () => {
      const mockTx = {
        select: vi.fn(() => { throw new Error('DB fail'); }),
        insert: vi.fn(() => chain(undefined)),
        update: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await addClaimNote('CLM-001', 'msg', 'u1', true, mockTx as any);
      expect(result).toEqual({ success: false, error: 'DB fail' });
    });
  });

  // ── updateClaimStatus ─────────────────────────────────────────────────────
  describe('updateClaimStatus', () => {
    const baseClaim = {
      claimId: 'uuid-1', claimNumber: 'CLM-001', status: 'submitted',
      priority: 'medium', description: 'A description longer than twenty chars for checks',
      createdAt: new Date('2026-03-01'), updatedAt: new Date('2026-03-01'),
      assignedTo: null, organizationId: 'org1', memberId: 'member1',
      progress: 10, closedAt: null, claimType: 'grievance', id: 1,
    };

    it('transitions to under_review', async () => {
      mocks.mockValidateTransition.mockReturnValue({ allowed: true, metadata: {} });
      mocks.mockDetectSignals.mockResolvedValue([]);
      const updatedClaim = { ...baseClaim, status: 'under_review', progress: 25 };
      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce(chain([baseClaim]))
          .mockReturnValueOnce(chain([{ role: 'steward' }])),
        update: vi.fn(() => chain([updatedClaim])),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('CLM-001', 'under_review' as any, 'user1', 'reviewing', mockTx as any);
      expect(result.success).toBe(true);
    });

    it('returns error when claim not found', async () => {
      const mockTx = {
        select: vi.fn(() => chain([])),
        update: vi.fn(() => chain(undefined)),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('MISSING', 'under_review' as any, 'u1', '', mockTx as any);
      expect(result).toEqual({ success: false, error: 'Claim not found' });
    });

    it('returns error when FSM rejects transition', async () => {
      mocks.mockValidateTransition.mockReturnValue({ allowed: false, reason: 'Not allowed' });
      mocks.mockDetectSignals.mockResolvedValue([]);
      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce(chain([baseClaim]))
          .mockReturnValueOnce(chain([{ role: 'member' }])),
        update: vi.fn(() => chain(undefined)),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('CLM-001', 'closed' as any, 'u1', '', mockTx as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not allowed');
    });

    it('wraps in RLS context when no tx', async () => {
      mocks.mockWithRLS.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        mocks.mockValidateTransition.mockReturnValue({ allowed: true, metadata: {} });
        mocks.mockDetectSignals.mockResolvedValue([]);
        const updatedClaim = { ...baseClaim, status: 'under_review' };
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce(chain([baseClaim]))
            .mockReturnValueOnce(chain([{ role: 'steward' }])),
          update: vi.fn(() => chain([updatedClaim])),
          insert: vi.fn(() => chain(undefined)),
        };
        return fn(mockTx);
      });
      const result = await updateClaimStatus('CLM-001', 'under_review' as any, 'user1', 'notes');
      expect(result.success).toBe(true);
      expect(mocks.mockWithRLS).toHaveBeenCalled();
    });

    it('generates defensibility pack on resolved', async () => {
      mocks.mockValidateTransition.mockReturnValue({ allowed: true, metadata: {} });
      mocks.mockDetectSignals.mockResolvedValue([]);
      const claim = { ...baseClaim, status: 'under_review', assignedTo: 'steward1' };
      const updatedClaim = { ...claim, status: 'resolved', progress: 90, updatedAt: new Date() };

      mocks.mockGenerateDefPack.mockResolvedValue({
        exportVersion: '1.0', generatedAt: new Date(), generatedBy: 'system',
        exportMetadata: { purpose: 'arbitration', requestedBy: 'system' },
        integrity: { combinedHash: 'h', timelineHash: 'th', auditHash: 'ah', stateTransitionHash: 'sh' },
      });
      mocks.mockCreateSatisfactionSurvey.mockResolvedValue(undefined);

      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce(chain([claim]))                 // find claim
          .mockReturnValueOnce(chain([{ role: 'steward' }]))   // user role
          .mockReturnValueOnce(chain([]))                       // claimUpdates
          .mockReturnValueOnce(chain([{ displayName: 'Jane' }])), // getMemberName
        update: vi.fn(() => chain([updatedClaim])),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('CLM-001', 'resolved' as any, 'user1', 'done', mockTx as any);
      expect(result.success).toBe(true);
      expect(mocks.mockGenerateDefPack).toHaveBeenCalled();
    });
  });
});
