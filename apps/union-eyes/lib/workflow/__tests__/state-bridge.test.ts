import { describe, expect, it } from 'vitest';

import {
  inferResolutionType,
  migrateStates,
  toLegacyCaseState,
  toLegacyClaimStatus,
  toLegacyGrievanceStatus,
  toLifecycleState,
} from '../state-bridge';

describe('lib/workflow/state-bridge', () => {
  describe('toLifecycleState', () => {
    it('maps each legacy FSM state to a unified state', () => {
      expect(toLifecycleState('case', 'acknowledged')).toBe('triage');
      expect(toLifecycleState('claim', 'under_review')).toBe('triage');
      expect(toLifecycleState('grievance', 'converted')).toBe('submitted');
      expect(toLifecycleState('cupe', 'filed')).toBe('submitted');
    });
    it('returns null for unknown states and unknown fsm', () => {
      expect(toLifecycleState('case', 'nope')).toBeNull();
      expect(toLifecycleState('mystery' as never, 'draft')).toBeNull();
    });
  });

  describe('inferResolutionType', () => {
    it('infers resolution from terminal states', () => {
      expect(inferResolutionType('withdrawn')).toBe('withdrawn');
      expect(inferResolutionType('rejected')).toBe('denied');
      expect(inferResolutionType('settled')).toBe('settled');
      expect(inferResolutionType('triage')).toBeNull();
    });
  });

  describe('reverse mappings', () => {
    it('converts unified to each legacy FSM', () => {
      expect(toLegacyCaseState('triage')).toBe('acknowledged');
      expect(toLegacyClaimStatus('triage')).toBe('under_review');
      expect(toLegacyGrievanceStatus('submitted')).toBe('new');
    });
  });

  describe('migrateStates', () => {
    it('bulk-converts with unified + resolution type', () => {
      const result = migrateStates('case', ['acknowledged', 'withdrawn', 'unknown']);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ legacy: 'acknowledged', unified: 'triage', resolutionType: null });
      expect(result[1].resolutionType).toBe('withdrawn');
      expect(result[2].unified).toBeNull();
    });
  });
});
