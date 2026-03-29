/**
 * Case Assignment Engine — Unit Tests
 *
 * Covers autoAssignGrievance, manuallyAssignGrievance, reassignGrievance,
 * getAssignmentRecommendations, getOfficerWorkload, getOrgWorkloadReport,
 * suggestWorkloadBalancing, addCollaborator, removeCollaborator, getGrievanceTeam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockInsertReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockClaimsFindFirst: vi.fn(),
  mockAssignmentsFindFirst: vi.fn(),
  mockAssignmentsFindMany: vi.fn(),
  mockMembersFindFirst: vi.fn(),
  mockMembersFindMany: vi.fn(),
  mockWithRLS: vi.fn(),
  mockGetProtocol: vi.fn(),
  mockGetPrimaryRole: vi.fn(),
}));

/* ── mocks ──────────────────────────────────────────────────────────── */

function makeRlsDb() {
  return {
    query: {
      claims: { findFirst: mocks.mockClaimsFindFirst },
      grievanceAssignments: {
        findFirst: mocks.mockAssignmentsFindFirst,
        findMany: mocks.mockAssignmentsFindMany,
      },
      organizationMembers: {
        findFirst: mocks.mockMembersFindFirst,
        findMany: mocks.mockMembersFindMany,
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.mockUpdateWhere,
      })),
    })),
  };
}

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.mockUpdateWhere,
      })),
    })),
    query: {
      claims: { findFirst: mocks.mockClaimsFindFirst },
      grievanceAssignments: {
        findFirst: mocks.mockAssignmentsFindFirst,
        findMany: mocks.mockAssignmentsFindMany,
      },
      organizationMembers: {
        findFirst: mocks.mockMembersFindFirst,
        findMany: mocks.mockMembersFindMany,
      },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  claims: {
    claimId: 'claimId',
    organizationId: 'organizationId',
    assignedTo: 'assignedTo',
    assignedAt: 'assignedAt',
    status: 'status',
  },
  grievanceAssignments: {
    id: 'id',
    claimId: 'claimId',
    assignedTo: 'assignedTo',
    status: 'status',
    organizationId: 'organizationId',
    assignedAt: 'assignedAt',
    $inferInsert: { role: '' },
  },
  organizationMembers: {
    organizationId: 'organizationId',
    userId: 'userId',
    role: 'role',
    status: 'status',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.mockWithRLS,
}));

vi.mock('@/lib/representation', () => ({
  getRepresentationProtocol: mocks.mockGetProtocol,
  getPrimaryAssignmentRole: mocks.mockGetPrimaryRole,
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  autoAssignGrievance,
  __testInternals,
  manuallyAssignGrievance,
  reassignGrievance,
  getAssignmentRecommendations,
  getOfficerWorkload,
  getOrgWorkloadReport,
  suggestWorkloadBalancing,
  addCollaborator,
  removeCollaborator,
  getGrievanceTeam,
} from '../case-assignment-engine';

/* ── helpers ────────────────────────────────────────────────────────── */

const baseClaim = {
  claimId: 'claim-1',
  organizationId: 'org-1',
  status: 'open',
  claimType: 'grievance',
  resolutionOutcome: null,
};

const baseOfficer = {
  userId: 'officer-1',
  membershipNumber: 'OFF-001',
  role: 'union_officer',
  status: 'active',
};

const baseAssignment = {
  id: 'asgn-1',
  claimId: 'claim-1',
  organizationId: 'org-1',
  assignedTo: 'officer-1',
  role: 'primary_officer',
  status: 'assigned',
  assignedBy: 'admin',
  assignedAt: new Date('2025-01-01'),
  completedAt: null,
  estimatedHours: '4',
  assignmentReason: 'Auto-assigned',
  notes: null,
  claim: baseClaim,
};

/* ── tests ──────────────────────────────────────────────────────────── */

describe('case-assignment-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default implementations
    mocks.mockGetProtocol.mockResolvedValue({
      stewardPermissions: { canBeAssigned: false },
    });
    mocks.mockGetPrimaryRole.mockReturnValue('primary_officer');
    mocks.mockInsertReturning.mockResolvedValue([{ id: 'asgn-new' }]);
    mocks.mockUpdateWhere.mockResolvedValue(undefined);
    mocks.mockClaimsFindFirst.mockResolvedValue(baseClaim);
    mocks.mockAssignmentsFindFirst.mockResolvedValue(null);
    mocks.mockAssignmentsFindMany.mockResolvedValue([]);
    mocks.mockMembersFindFirst.mockResolvedValue(baseOfficer);
    mocks.mockMembersFindMany.mockResolvedValue([]);
    // Default: pass mock db to callback
    mocks.mockWithRLS.mockImplementation(
      (_opts: unknown, fn: (db: unknown) => unknown) => fn(makeRlsDb()),
    );
  });

  // ── autoAssignGrievance ───────────────────────────────────────────
  describe('autoAssignGrievance', () => {
    it('returns error when claim not found', async () => {
      mocks.mockClaimsFindFirst.mockResolvedValue(null);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toContain('Claim not found');
    });

    it('returns error when no eligible officers', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([]);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toContain('No eligible officers');
    });

    it('assigns to best-fit officer', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1', membershipNumber: 'OFF-1' },
      ]);
      // getOfficerWorkload returns low load
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin', { minScore: 20 });
      expect(r.success).toBe(true);
      expect(r.assignedTo).toBe('off-1');
      expect(r.role).toBe('primary_officer');
    });

    it('returns error when best match is overloaded (score too low)', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
      ]);
      // Simulate overloaded (21 active cases, max 20)
      const activeCases = Array.from({ length: 21 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(activeCases);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin');
      expect(r.success).toBe(false);
      // Overloaded officers score below default minScore (60)
      expect(r.error).toContain('minimum qualification');
    });

    it('returns manual-assignment error when overloaded officer still meets min score', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
      ]);
      const activeCases = Array.from({ length: 21 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(activeCases);

      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin', { minScore: 0 });
      expect(r.success).toBe(false);
      expect(r.error).toContain('Manual assignment required');
    });

    it('handles thrown errors gracefully', async () => {
      mocks.mockGetProtocol.mockRejectedValue(new Error('DB error'));
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toBe('DB error');
    });

    it('returns unknown error when non-Error is thrown', async () => {
      mocks.mockGetProtocol.mockRejectedValue('boom');
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Unknown error');
    });

    it('uses protocol-derived role from getPrimaryAssignmentRole', async () => {
      mocks.mockGetPrimaryRole.mockReturnValue('secondary_officer');
      mocks.mockMembersFindMany.mockResolvedValue([baseOfficer]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin', { minScore: 20 });
      expect(r.success).toBe(true);
      expect(r.role).toBe('secondary_officer');
    });

    it('respects minScore option', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
      ]);
      // Officer will have low score since no expertise match and near capacity
      const cases = Array.from({ length: 18 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(cases);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin', { minScore: 100 });
      expect(r.success).toBe(false);
      expect(r.error).toContain('minimum qualification');
      expect(r.recommendations).toBeDefined();
    });
  });

  // ── manuallyAssignGrievance ───────────────────────────────────────
  describe('manuallyAssignGrievance', () => {
    it('assigns officer successfully', async () => {
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'off-1', 'admin');
      expect(r.success).toBe(true);
      expect(r.assignmentId).toBe('asgn-new');
    });

    it('returns error when officer already assigned', async () => {
      mocks.mockAssignmentsFindFirst.mockResolvedValue(baseAssignment);
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'officer-1', 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toContain('already assigned');
    });

    it('checks workload and rejects overloaded officer', async () => {
      // getOfficerWorkload returns >100% utilization
      const many = Array.from({ length: 25 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(many);
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'off-1', 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toContain('capacity');
    });

    it('bypasses workload check when requested', async () => {
      const many = Array.from({ length: 25 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(many);
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'off-1', 'admin', {
        bypassWorkloadCheck: true,
      });
      expect(r.success).toBe(true);
    });

    it('handles errors', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('RLS fail'));
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'off-1', 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toBe('RLS fail');
    });

    it('returns unknown error when non-Error is thrown', async () => {
      mocks.mockWithRLS.mockRejectedValue('boom');
      const r = await manuallyAssignGrievance('claim-1', 'org-1', 'off-1', 'admin');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Unknown error');
    });
  });

  // ── reassignGrievance ─────────────────────────────────────────────
  describe('reassignGrievance', () => {
    it('reassigns successfully', async () => {
      mocks.mockAssignmentsFindFirst
        .mockResolvedValueOnce({ ...baseAssignment, role: 'primary_officer', estimatedHours: '8' })
        .mockResolvedValueOnce(null); // no existing assignment for new officer
      const r = await reassignGrievance('claim-1', 'org-1', 'asgn-1', 'off-2', 'admin', 'Workload balancing');
      expect(r.success).toBe(true);
    });

    it('returns error if assignment not found', async () => {
      mocks.mockAssignmentsFindFirst.mockResolvedValue(null);
      const r = await reassignGrievance('claim-1', 'org-1', 'asgn-x', 'off-2', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
    });

    it('returns unknown error when non-Error is thrown', async () => {
      mocks.mockWithRLS.mockRejectedValue('boom');
      const r = await reassignGrievance('claim-1', 'org-1', 'asgn-1', 'off-2', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Unknown error');
    });
  });

  // ── getAssignmentRecommendations ──────────────────────────────────
  describe('getAssignmentRecommendations', () => {
    it('returns ranked recommendations', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
        { ...baseOfficer, userId: 'off-2', membershipNumber: 'OFF-2' },
      ]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const recs = await getAssignmentRecommendations('claim-1', 'org-1', {});
      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs[0].score).toBeGreaterThanOrEqual(0);
    });

    it('returns empty when claim not found', async () => {
      mocks.mockClaimsFindFirst.mockResolvedValue(null);
      expect(await getAssignmentRecommendations('claim-x', 'org-1', {})).toEqual([]);
    });

    it('returns empty on error', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      expect(await getAssignmentRecommendations('claim-1', 'org-1', {})).toEqual([]);
    });

    it('scores expertise/location/success and capacity branches via internals', async () => {
      const officers = [
        {
          userId: 'expert-1',
          name: 'Expert',
          role: 'union_officer',
          expertise: ['grievance'],
          maxCaseload: 20,
          currentCaseload: 4,
          availableHours: 40,
          locations: ['Kigali'],
          successRate: 85,
          avgResolutionDays: 10,
          languages: ['English'],
          certifications: [],
        },
        {
          userId: 'general-1',
          name: 'Generalist',
          role: 'union_officer',
          expertise: ['discipline'],
          maxCaseload: 20,
          currentCaseload: 12,
          availableHours: 20,
          locations: ['Butare'],
          successRate: 65,
          avgResolutionDays: 12,
          languages: ['English'],
          certifications: [],
        },
        {
          userId: 'over-1',
          name: 'Overloaded',
          role: 'union_officer',
          expertise: [],
          maxCaseload: 20,
          currentCaseload: 21,
          availableHours: 10,
          locations: [],
          successRate: 10,
          avgResolutionDays: 20,
          languages: ['English'],
          certifications: [],
        },
      ];

      const recs = await __testInternals.scoreOfficers(
        officers,
        {},
        { claimType: 'grievance', location: 'Kigali', estimatedHours: 8 },
        'org-1',
      );

      expect(recs.length).toBe(3);
      expect(recs[0].userId).toBe('expert-1');
      expect(recs.find((r) => r.userId === 'expert-1')?.reasons).toContain('Expertise in claim type');
      expect(recs.find((r) => r.userId === 'general-1')?.reasons).toContain('General expertise');
      expect(recs.find((r) => r.userId === 'over-1')?.availability).toBe('overloaded');
    });

    it('falls back to userId when membershipNumber is missing', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-fallback', membershipNumber: null },
      ]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const recs = await getAssignmentRecommendations('claim-1', 'org-1', {});
      expect(recs[0].name).toBe('off-fallback');
    });

    it('returns empty when internal eligible-officer query fails', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('eligible-fail'));
      const officers = await __testInternals.getEligibleOfficers('org-1', {}, undefined);
      expect(officers).toEqual([]);
    });

    it('supports steward assignment role filter branch', async () => {
      mocks.mockGetProtocol.mockResolvedValue({ stewardPermissions: { canBeAssigned: true } });
      mocks.mockMembersFindMany.mockResolvedValue([{ ...baseOfficer, role: 'union_steward' }]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const r = await autoAssignGrievance('claim-1', 'org-1', {}, 'admin', { minScore: 20 });
      expect(r.success).toBe(true);
    });
  });

  // ── getOfficerWorkload ────────────────────────────────────────────
  describe('getOfficerWorkload', () => {
    it('returns workload stats', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([
        { ...baseAssignment, status: 'assigned', estimatedHours: '4', claim: baseClaim },
        {
          ...baseAssignment,
          id: 'a-2',
          status: 'completed',
          completedAt: new Date('2025-02-01'),
          estimatedHours: '8',
          claim: { ...baseClaim, status: 'resolved', resolutionOutcome: 'favorable' },
        },
      ]);
      const stats = await getOfficerWorkload('officer-1', 'org-1');
      expect(stats).not.toBeNull();
      expect(stats!.totalCases).toBe(2);
      expect(stats!.activeCases).toBe(1);
      expect(stats!.completedCases).toBe(1);
      expect(stats!.successRate).toBe(100);
    });

    it('returns null on error', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      expect(await getOfficerWorkload('off-1', 'org-1')).toBeNull();
    });

    it('calculates avgResolutionDays for completed cases', async () => {
      const assignedAt = new Date('2025-01-01');
      const completedAt = new Date('2025-01-11'); // 10 days later
      mocks.mockAssignmentsFindMany.mockResolvedValue([
        {
          ...baseAssignment,
          status: 'completed',
          assignedAt,
          completedAt,
          claim: { ...baseClaim, status: 'resolved' },
        },
      ]);
      const stats = await getOfficerWorkload('officer-1', 'org-1');
      expect(stats!.avgResolutionDays).toBe(10);
    });

    it('handles incomplete completed records and invalid estimated hours', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([
        {
          ...baseAssignment,
          status: 'completed',
          assignedAt: new Date('2025-01-01'),
          completedAt: null,
          claim: { ...baseClaim, status: 'resolved' },
        },
        {
          ...baseAssignment,
          id: 'active-1',
          status: 'assigned',
          estimatedHours: 'abc',
          claim: baseClaim,
        },
      ]);
      mocks.mockMembersFindFirst.mockResolvedValue({ userId: 'fallback-user', membershipNumber: null });

      const stats = await getOfficerWorkload('fallback-user', 'org-1');
      expect(stats).not.toBeNull();
      expect(stats!.name).toBe('fallback-user');
      expect(stats!.avgResolutionDays).toBe(0);
      expect(stats!.estimatedHoursRemaining).toBe(0);
    });

    it('counts favorable outcome when status is not resolved', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([
        {
          ...baseAssignment,
          status: 'completed',
          claim: { ...baseClaim, status: 'open', resolutionOutcome: 'favorable' },
        },
      ]);
      const stats = await getOfficerWorkload('officer-1', 'org-1');
      expect(stats!.successRate).toBe(100);
    });

    it('uses Unknown name when officer profile is missing', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      mocks.mockMembersFindFirst.mockResolvedValue(null);
      const stats = await getOfficerWorkload('officer-1', 'org-1');
      expect(stats!.name).toBe('Unknown');
    });
  });

  // ── getOrgWorkloadReport ──────────────────────────────────────────
  describe('getOrgWorkloadReport', () => {
    it('returns stats for all officers sorted by utilization', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
        { ...baseOfficer, userId: 'off-2', membershipNumber: 'OFF-2' },
      ]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      const report = await getOrgWorkloadReport('org-1');
      expect(report.length).toBe(2);
    });

    it('returns empty on error', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      expect(await getOrgWorkloadReport('org-1')).toEqual([]);
    });

    it('skips officers whose workload cannot be computed', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'off-1' },
        { ...baseOfficer, userId: 'off-2', membershipNumber: 'OFF-2' },
      ]);
      mocks.mockAssignmentsFindMany
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce([]);

      const report = await getOrgWorkloadReport('org-1');
      expect(report).toHaveLength(1);
      expect(report[0].userId).toBe('off-2');
    });
  });

  // ── suggestWorkloadBalancing ──────────────────────────────────────
  describe('suggestWorkloadBalancing', () => {
    it('returns empty when no imbalance', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([baseOfficer]);
      mocks.mockAssignmentsFindMany.mockResolvedValue([]);
      expect(await suggestWorkloadBalancing('org-1')).toEqual([]);
    });

    it('suggests moves from overloaded to available', async () => {
      // Two officers
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'busy-1', membershipNumber: 'BUSY' },
        { ...baseOfficer, userId: 'free-1', membershipNumber: 'FREE' },
      ]);

      // Control what findMany returns per call:
      // 1st call: getOrgWorkloadReport → findMany officers
      // 2nd/3rd calls: getOfficerWorkload for each officer
      // 4th call: suggestWorkloadBalancing → findMany recent assignments
      let callCount = 0;
      mocks.mockAssignmentsFindMany.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          // busy officer: 19 active cases
          return Promise.resolve(
            Array.from({ length: 19 }, (_, i) => ({
              ...baseAssignment,
              id: `b-${i}`,
              assignedTo: 'busy-1',
              status: 'assigned',
              estimatedHours: '2',
              claim: baseClaim,
            })),
          );
        }
        if (callCount === 2) {
          // free officer: 0 cases
          return Promise.resolve([]);
        }
        // Recent assignments for suggester
        return Promise.resolve([
          { ...baseAssignment, claimId: 'claim-99', assignedTo: 'busy-1' },
        ]);
      });

      const suggestions = await suggestWorkloadBalancing('org-1');
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      // Officer name comes from getOfficerWorkload → organizationMembers.findFirst
      expect(suggestions[0].currentOfficer).toBeDefined();
    });

    it('returns empty on error', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      expect(await suggestWorkloadBalancing('org-1')).toEqual([]);
    });

    it('returns empty when recent-assignment lookup throws inside balancing loop', async () => {
      mocks.mockMembersFindMany.mockResolvedValue([
        { ...baseOfficer, userId: 'busy-1', membershipNumber: 'BUSY' },
        { ...baseOfficer, userId: 'free-1', membershipNumber: 'FREE' },
      ]);

      let assignmentsCall = 0;
      mocks.mockAssignmentsFindMany.mockImplementation(() => {
        assignmentsCall++;
        if (assignmentsCall === 1) {
          return Promise.resolve(
            Array.from({ length: 19 }, (_, i) => ({
              ...baseAssignment,
              id: `b-${i}`,
              assignedTo: 'busy-1',
              status: 'assigned',
              estimatedHours: '2',
              claim: baseClaim,
            })),
          );
        }
        if (assignmentsCall === 2) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      let withRlsCalls = 0;
      mocks.mockWithRLS.mockImplementation((_opts: unknown, fn: (db: unknown) => unknown) => {
        withRlsCalls++;
        if (withRlsCalls === 6) {
          throw new Error('recent-fetch-fail');
        }
        return fn(makeRlsDb());
      });

      const suggestions = await suggestWorkloadBalancing('org-1');
      expect(suggestions).toEqual([]);
    });
  });

  // ── addCollaborator ───────────────────────────────────────────────
  describe('addCollaborator', () => {
    it('delegates to manuallyAssignGrievance', async () => {
      const r = await addCollaborator('claim-1', 'org-1', 'user-2', 'legal_counsel', 'admin');
      expect(r.success).toBe(true);
      expect(r.assignmentId).toBe('asgn-new');
    });

    it('bypasses workload check for non-officer roles', async () => {
      // Even if overloaded, legal_counsel bypasses workload check
      const many = Array.from({ length: 25 }, (_, i) => ({
        ...baseAssignment,
        id: `a-${i}`,
        status: 'assigned',
        estimatedHours: '2',
        claim: baseClaim,
      }));
      mocks.mockAssignmentsFindMany.mockResolvedValue(many);
      const r = await addCollaborator('claim-1', 'org-1', 'user-2', 'observer', 'admin');
      expect(r.success).toBe(true);
    });
  });

  // ── removeCollaborator ────────────────────────────────────────────
  describe('removeCollaborator', () => {
    it('removes non-primary assignment', async () => {
      mocks.mockAssignmentsFindFirst.mockResolvedValue({
        ...baseAssignment,
        role: 'secondary_officer',
      });
      const r = await removeCollaborator('asgn-1', 'org-1', 'admin', 'No longer needed');
      expect(r.success).toBe(true);
    });

    it('refuses to remove primary officer', async () => {
      mocks.mockAssignmentsFindFirst.mockResolvedValue({
        ...baseAssignment,
        role: 'primary_officer',
      });
      const r = await removeCollaborator('asgn-1', 'org-1', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toContain('primary officer');
    });

    it('returns error if not found', async () => {
      mocks.mockAssignmentsFindFirst.mockResolvedValue(null);
      const r = await removeCollaborator('asgn-x', 'org-1', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
    });

    it('handles errors', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      const r = await removeCollaborator('asgn-1', 'org-1', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toBe('fail');
    });

    it('returns unknown error when non-Error is thrown', async () => {
      mocks.mockWithRLS.mockRejectedValue('boom');
      const r = await removeCollaborator('asgn-1', 'org-1', 'admin', 'reason');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Unknown error');
    });
  });

  // ── getGrievanceTeam ──────────────────────────────────────────────
  describe('getGrievanceTeam', () => {
    it('returns enriched team members', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([baseAssignment]);
      mocks.mockMembersFindFirst.mockResolvedValue(baseOfficer);
      const team = await getGrievanceTeam('claim-1', 'org-1');
      expect(team).toHaveLength(1);
      expect(team[0].officerName).toBe('OFF-001');
      expect(team[0].officerRole).toBe('union_officer');
    });

    it('handles missing officer gracefully', async () => {
      mocks.mockAssignmentsFindMany.mockResolvedValue([baseAssignment]);
      mocks.mockMembersFindFirst.mockResolvedValue(null);
      const team = await getGrievanceTeam('claim-1', 'org-1');
      expect(team[0].officerName).toBe('Unknown');
    });

    it('returns empty on error', async () => {
      mocks.mockWithRLS.mockRejectedValue(new Error('fail'));
      expect(await getGrievanceTeam('claim-1', 'org-1')).toEqual([]);
    });
  });
});
