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
  batch:vi.fn(),actor: vi.fn(), findReadable: vi.fn(), requireAction: vi.fn(), decideCase: vi.fn(), audit: vi.fn(), queueMail: vi.fn(),
}));

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
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
    select: (...a: any[]) => mocks.mockSelect(...a),
    update: (...a: any[]) => mocks.mockUpdate(...a),
    insert: (...a: any[]) => mocks.mockInsert(...a),
  },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (...a: any[]) => mocks.mockWithRLS(...a),
  withSystemRLSContext: (_reason: string, fn: (tx: any) => unknown) => fn({
    select: (...a: any[]) => mocks.mockSelect(...a),
    update: (...a: any[]) => mocks.mockUpdate(...a),
    insert: (...a: any[]) => mocks.mockInsert(...a),
  }),
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
vi.mock('@/lib/services/claim-workflow-fsm', () => ({
  validateClaimTransition: (...a: any[]) => mocks.mockValidateTransition(...a),
  getAllowedClaimTransitions: (...a: any[]) => mocks.mockGetAllowedTransitions(...a),
}));
vi.mock('@/lib/services/lro-signals', () => ({
  detectAllSignals: (...a: any[]) => mocks.mockDetectSignals(...a),
}));
vi.mock('@/lib/services/defensibility-pack', () => ({
  generateDefensibilityPack: (...a: any[]) => mocks.mockGenerateDefPack(...a),
}));
vi.mock('@/db/schema/defensibility-packs-schema', () => ({
  defensibilityPacks: {},
}));
vi.mock('@/lib/events/event-bus', () => ({
  eventBus: { emit: (...a: any[]) => mocks.mockEventBusEmit(...a), on: vi.fn() },
}));
vi.mock('@/lib/services/satisfaction-service', () => ({
  createSatisfactionSurvey: (...a: any[]) => mocks.mockCreateSatisfactionSurvey(...a),
}));
// The history reference is a SQL sub-select in production; this suite mocks drizzle-orm without sql, so it is passed through.
vi.mock('@/lib/cases/claim-history-reference', () => ({ claimHistoryReference: (id: string) => id }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/cases/case-authorization', () => ({ getCaseActor: mocks.actor, findReadableCase: mocks.findReadable,
  caseReadScope: vi.fn(), requireKernelCaseAction: mocks.requireAction }));
vi.mock('@/lib/authority/store/route-adapter', () => ({ decideCase: mocks.decideCase,decideCaseCapabilitiesBatch:mocks.batch }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/workflow/case-status-delivery', () => ({ queueCaseStatusEmail: mocks.queueMail }));

/* ── imports ───────────────────────────────────────────────────────────────── */
import {
  isValidTransition,
  getAllowedTransitions,
  calculateDeadline,
  isClaimOverdue,
  getDaysUntilDeadline,
  getClaimWorkflowStatus,
  updateClaimStatus,
  updateClaimStatusById,
  getOverdueClaims,
  getClaimsApproachingDeadline,
  STATUS_TRANSITIONS,
  STATUS_DEADLINES,
  PRIORITY_MULTIPLIERS,
} from '../workflow-engine';

/* ── tests ─────────────────────────────────────────────────────────────────── */
describe('workflow-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batch.mockImplementation(async(_tx,input)=>new Map(input.caseIds.map((id:string)=>[id,{'case:read':{effect:'allow',scope:{visibility:'internal'}}}])));
    mocks.actor.mockResolvedValue({userId:'user1',organizationId:'org1',role:'steward'});
    mocks.findReadable.mockResolvedValue({claimId:'uuid-1',visibility:'internal'});
    mocks.requireAction.mockResolvedValue(undefined); mocks.decideCase.mockResolvedValue({effect:'allow'});
    mocks.audit.mockResolvedValue(undefined); mocks.queueMail.mockResolvedValue('task');
    mocks.mockWithRLS.mockImplementation(async fn => fn({select:(...args:unknown[])=>mocks.mockSelect(...args),update:mocks.mockUpdate,insert:mocks.mockInsert}));
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
      const claim = { status: 'submitted', priority: 'medium', statusChangedAt: new Date(), createdAt: new Date(), progress: 10 };
      const result = getClaimWorkflowStatus(claim);
      expect(result.currentStatus).toBe('submitted');
      expect(result.priority).toBe('medium');
      expect(result.allowedTransitions).toContain('under_review');
      expect(result.progress).toBe(10);
    });

    // Disclosed adaptation: these tests used updatedAt as the SLA clock, which let any edit restart it. The clock is now the last status change.
    it('uses createdAt when the status change is unknown', () => {
      const createdAt = new Date('2026-03-01');
      const result = getClaimWorkflowStatus({
        status: 'investigation', priority: 'high', statusChangedAt: null, createdAt, progress: 50,
      });
      expect(result.statusSince).toBe(createdAt);
    });

    it('does not restart the clock on an edit: updatedAt is not the SLA clock', () => {
      const createdAt = new Date('2026-03-01');
      const statusChangedAt = new Date('2026-03-05');
      const result = getClaimWorkflowStatus({
        status: 'investigation', priority: 'high', statusChangedAt, updatedAt: new Date(), createdAt, progress: 50,
      } as Parameters<typeof getClaimWorkflowStatus>[0] & { updatedAt: Date });
      expect(result.statusSince).toBe(statusChangedAt);
    });
  });

  // ── getOverdueClaims ──────────────────────────────────────────────────────
  describe('getOverdueClaims', () => {
    it('filters overdue claims', async () => {
      const pastDate = new Date('2024-01-01');
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'submitted', priority: 'medium', statusChangedAt: pastDate, createdAt: pastDate },
        { status: 'closed', priority: 'medium', statusChangedAt: pastDate, createdAt: pastDate },
      ]));
      const result = await getOverdueClaims();
      expect(result).toHaveLength(1);
    });

    it('propagates an outage rather than fabricating an empty success', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(getOverdueClaims()).rejects.toThrow('fail');
    });

    it('skips claims with no dates', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'submitted', priority: 'medium', statusChangedAt: null, createdAt: null },
      ]));
      const result = await getOverdueClaims();
      expect(result).toHaveLength(0);
    });
  });

  // ── getClaimsApproachingDeadline ──────────────────────────────────────────
  describe('getClaimsApproachingDeadline', () => {
    it('filters claims within 1 day of deadline', async () => {
      // investigation = 10 days × medium 1.0 → deadline in 10 days from statusDate
      // The deadline is calendar-day arithmetic (setDate), so the fixture is built the same way: a status date whose deadline falls 12
      // hours from now. Counting 9 x 24h back from now made the test depend on whether a daylight-saving change falls inside the window.
      const nineDaysAgo = new Date(Date.now() + 12 * 3600_000);
      nineDaysAgo.setDate(nineDaysAgo.getDate() - 10);
      mocks.mockSelect.mockReturnValueOnce(chain([
        { status: 'investigation', priority: 'medium', statusChangedAt: nineDaysAgo, createdAt: nineDaysAgo },
        { status: 'closed', priority: 'medium', statusChangedAt: nineDaysAgo, createdAt: nineDaysAgo },
      ]));
      const result = await getClaimsApproachingDeadline();
      expect(result).toHaveLength(1);
    });

    it('propagates an outage rather than fabricating an empty success', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('fail'); });
      await expect(getClaimsApproachingDeadline()).rejects.toThrow('fail');
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
          .mockReturnValueOnce(chain([baseClaim])),
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
      const result = await updateClaimStatus('MISSING', 'under_review' as any, 'user1', '', mockTx as any);
      expect(result).toEqual({ success: false, error: 'Claim not found' });
    });

    it('returns error when FSM rejects transition', async () => {
      mocks.mockValidateTransition.mockReturnValue({ allowed: false, reason: 'Not allowed' });
      mocks.mockDetectSignals.mockResolvedValue([]);
      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce(chain([baseClaim])),
        update: vi.fn(() => chain(undefined)),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('CLM-001', 'closed' as any, 'user1', '', mockTx as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not allowed');
    });

    it('wraps in RLS context when no tx', async () => {
      mocks.mockWithRLS.mockImplementation(async (fn: (...args: any[]) => unknown) => {
        mocks.mockValidateTransition.mockReturnValue({ allowed: true, metadata: {} });
        mocks.mockDetectSignals.mockResolvedValue([]);
        const updatedClaim = { ...baseClaim, status: 'under_review' };
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce(chain([baseClaim]))
            ,
          update: vi.fn(() => chain([updatedClaim])),
          insert: vi.fn(() => chain(undefined)),
        };
        return fn(mockTx);
      });
      const result = await updateClaimStatus('CLM-001', 'under_review' as any as Parameters<typeof updateClaimStatus>[1], 'user1', 'notes');
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
             // user role
          .mockReturnValueOnce(chain([]))                       // claimUpdates
          .mockReturnValueOnce(chain([{ displayName: 'Jane' }])), // getMemberName
        update: vi.fn(() => chain([updatedClaim])),
        insert: vi.fn(() => chain(undefined)),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatus('CLM-001', 'resolved' as any, 'user1', 'done', mockTx as any);
      expect(result.success).toBe(true);
      expect(mocks.mockGenerateDefPack).toHaveBeenCalledWith(expect.anything(),expect.anything(),expect.anything(),expect.anything(),expect.objectContaining({requestedBy:'user1',generatedBy:'user1'}));
    });
  });

  // ── updateClaimStatusById ───────────────────────────────────────────────
  describe('updateClaimStatusById', () => {
    const baseClaim = {
      claimId: 'uuid-1', claimNumber: 'CLM-001', status: 'submitted',
      priority: 'medium', description: 'A description longer than twenty chars for checks',
      createdAt: new Date('2026-03-01'), updatedAt: new Date('2026-03-01'),
      assignedTo: null, organizationId: 'org1', memberId: 'member1',
      progress: 10, closedAt: null, claimType: 'grievance', id: 1,
    };

    it('returns error when claim id is not found', async () => {
      const mockTx = {
        select: vi.fn(() => chain([])),
        update: vi.fn(() => chain(undefined)),
        insert: vi.fn(() => chain(undefined)),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatusById('missing', 'under_review' as any, 'user1', 'note', mockTx as any);
      expect(result).toEqual({ success: false, error: 'Claim not found' });
    });

    it('returns error when claimNumber is missing', async () => {
      const mockTx = {
        select: vi.fn(() => chain([{ claimNumber: null }])),
        update: vi.fn(() => chain(undefined)),
        insert: vi.fn(() => chain(undefined)),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatusById('uuid-1', 'under_review' as any, 'user1', 'note', mockTx as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing claimNumber');
    });

    it('delegates to FSM-enforced updateClaimStatus when claimNumber exists', async () => {
      mocks.mockValidateTransition.mockReturnValue({ allowed: true, metadata: {} });
      mocks.mockDetectSignals.mockResolvedValue([]);

      const updatedClaim = { ...baseClaim, status: 'under_review', progress: 25 };
      const mockTx = {
        select: vi.fn()
          .mockReturnValueOnce(chain([{ claimNumber: 'CLM-001' }]))
          .mockReturnValueOnce(chain([baseClaim])),
        update: vi.fn(() => chain([updatedClaim])),
        insert: vi.fn(() => chain(undefined)),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await updateClaimStatusById('uuid-1', 'under_review' as any, 'user1', 'reviewing', mockTx as any);
      expect(result.success).toBe(true);
    });
  });
  describe('transitive action and atomicity regressions', () => {
    const claim={claimId:'uuid-1',id:'internal',claimNumber:'CLM-1',organizationId:'org1',memberId:'member',
      status:'submitted',priority:'medium',description:'Synthetic description long enough',createdAt:new Date(),updatedAt:new Date()};
    const storedHistory=vi.fn();
    const tx=()=>({select:vi.fn(()=>chain([claim])),update:vi.fn(()=>chain([{...claim,status:'under_review'}])),insert:vi.fn(()=>({values:(value:unknown)=>{storedHistory(value);return Promise.resolve([])}}))});
    it('refuses a forged caller before any query or write', async()=>{
      const db=tx(); await expect(updateClaimStatus('CLM-1','under_review','forged',undefined,db as never)).rejects.toThrow('live session');
      expect(db.select).not.toHaveBeenCalled();expect(db.update).not.toHaveBeenCalled();expect(mocks.queueMail).not.toHaveBeenCalled();
    });
    it('does not widen a denied kernel transition in a downstream service', async()=>{
      const db=tx();mocks.findReadable.mockRejectedValue(new Error('Kernel denied'));
      await expect(updateClaimStatus('CLM-1','under_review','user1',undefined,db as never)).rejects.toThrow('Kernel denied');
      expect(db.update).not.toHaveBeenCalled();expect(mocks.queueMail).not.toHaveBeenCalled();
    });
    it('propagates mandatory audit failure without queue or provider effects', async()=>{
      const db=tx();mocks.mockDetectSignals.mockResolvedValue([]);mocks.mockValidateTransition.mockReturnValue({allowed:true});
      mocks.audit.mockRejectedValue(new Error('audit failed'));
      await expect(updateClaimStatus('CLM-1','under_review','user1','staff-only reason',db as never)).rejects.toThrow('audit failed');
      expect(mocks.queueMail).not.toHaveBeenCalled();expect(mocks.mockSendNotification).not.toHaveBeenCalled();
    });
    it('writes a generic member event and durable state-only notice while auditing the private reason', async()=>{
      const db=tx();mocks.mockDetectSignals.mockResolvedValue([]);mocks.mockValidateTransition.mockReturnValue({allowed:true});
      mocks.mockValidateTransition.mockReturnValue({allowed:true,warnings:['private FSM warning'],metadata:{slaCompliant:false,daysInState:4,nextDeadline:new Date('2026-11-18T00:00:00Z')}});
      await updateClaimStatus('CLM-1','under_review','user1','staff-only reason',db as never);
      expect(storedHistory).toHaveBeenLastCalledWith({claimId:'internal',updateType:'status_change',message:"Status changed from 'submitted' to 'under_review'",createdBy:'user1',isInternal:false,visibilityScope:'member',metadata:{previousStatus:'submitted',newStatus:'under_review'}});
      expect(mocks.audit).toHaveBeenCalledWith(db,expect.objectContaining({details:expect.objectContaining({reason:'staff-only reason',fsmValidation:expect.objectContaining({warnings:['private FSM warning']})})}));
      expect(mocks.queueMail).toHaveBeenCalledWith(db,{organizationId:'org1',caseId:'uuid-1',queuedBy:'user1',recipientId:'member',previousStatus:'submitted',newStatus:'under_review'});
      expect(mocks.mockSendNotification).not.toHaveBeenCalled();expect(mocks.mockAddTimeline).not.toHaveBeenCalled();
    });
    it('does not enumerate a candidate whose live kernel scope was revoked', async()=>{
      mocks.mockSelect.mockReturnValue(chain([{...claim,createdAt:new Date('2024-01-01'),statusChangedAt:new Date('2024-01-01')}]));
      mocks.batch.mockResolvedValue(new Map([['uuid-1',{'case:read':{effect:'deny',scope:{}}}]]));expect(await getOverdueClaims()).toEqual([]);
    });
  });

});
