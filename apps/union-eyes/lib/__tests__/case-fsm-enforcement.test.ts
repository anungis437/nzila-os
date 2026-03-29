import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStatusById: vi.fn(),
  getAllStatusIds: vi.fn(),
}));

vi.mock('@nzila/cupe-vocabulary', () => ({
  getStatusById: mocks.getStatusById,
  getAllStatusIds: mocks.getAllStatusIds,
}));

import { validateCUPETransition, getAllowedTransitions } from '../case-fsm-enforcement';

describe('case-fsm-enforcement', () => {
  describe('validateCUPETransition', () => {
    it('returns not-allowed when current status is unknown', () => {
      mocks.getStatusById.mockReturnValue(undefined);
      mocks.getAllStatusIds.mockReturnValue(['filed', 'investigation']);

      const result = validateCUPETransition({
        caseId: 'c-1',
        currentStatus: 'bogus',
        targetStatus: 'filed',
        actorRole: 'admin',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown current status');
    });

    it('returns not-allowed when target status is unknown', () => {
      mocks.getStatusById
        .mockReturnValueOnce({ id: 'filed', label: 'Filed', allowTransitionsTo: ['investigation'], allowedRoles: ['admin'] })
        .mockReturnValueOnce(undefined);
      mocks.getAllStatusIds.mockReturnValue(['filed', 'investigation']);

      const result = validateCUPETransition({
        caseId: 'c-1',
        currentStatus: 'filed',
        targetStatus: 'nonexistent',
        actorRole: 'admin',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown target status');
    });

    it('returns not-allowed when transition is not in allowTransitionsTo', () => {
      mocks.getStatusById
        .mockReturnValueOnce({
          id: 'filed', label: 'Filed',
          allowTransitionsTo: ['investigation'],
          allowedRoles: ['steward'],
        })
        .mockReturnValueOnce({
          id: 'resolved', label: 'Resolved',
          allowTransitionsTo: [],
          allowedRoles: ['admin'],
        });

      const result = validateCUPETransition({
        caseId: 'c-1',
        currentStatus: 'filed',
        targetStatus: 'resolved',
        actorRole: 'admin',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid transition');
    });

    it('returns not-allowed when actor role is insufficient', () => {
      mocks.getStatusById
        .mockReturnValueOnce({
          id: 'filed', label: 'Filed',
          allowTransitionsTo: ['investigation'],
          allowedRoles: ['steward'],
        })
        .mockReturnValueOnce({
          id: 'investigation', label: 'Investigation',
          allowTransitionsTo: [],
          allowedRoles: ['chief_steward', 'admin'],
        });

      const result = validateCUPETransition({
        caseId: 'c-1',
        currentStatus: 'filed',
        targetStatus: 'investigation',
        actorRole: 'member',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Role 'member'");
    });

    it('returns allowed for valid transition and role', () => {
      mocks.getStatusById
        .mockReturnValueOnce({
          id: 'filed', label: 'Filed',
          allowTransitionsTo: ['investigation'],
          allowedRoles: ['steward'],
        })
        .mockReturnValueOnce({
          id: 'investigation', label: 'Investigation',
          allowTransitionsTo: [],
          allowedRoles: ['steward', 'admin'],
        });

      const result = validateCUPETransition({
        caseId: 'c-1',
        currentStatus: 'filed',
        targetStatus: 'investigation',
        actorRole: 'admin',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns empty array for unknown status', () => {
      mocks.getStatusById.mockReturnValue(undefined);
      expect(getAllowedTransitions('bogus', 'admin')).toEqual([]);
    });

    it('filters transitions by actor role', () => {
      mocks.getStatusById
        .mockReturnValueOnce({
          id: 'filed',
          label: 'Filed',
          allowTransitionsTo: ['investigation', 'resolved'],
          allowedRoles: ['steward'],
        })
        // investigation status def
        .mockReturnValueOnce({
          id: 'investigation', label: 'Investigation',
          allowedRoles: ['steward', 'admin'],
        })
        // resolved status def
        .mockReturnValueOnce({
          id: 'resolved', label: 'Resolved',
          allowedRoles: ['admin'],
        });

      const transitions = getAllowedTransitions('filed', 'steward');

      expect(transitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ statusId: 'investigation' }),
        ]),
      );
    });
  });
});
