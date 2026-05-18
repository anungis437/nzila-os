import { describe, it, expect } from 'vitest';
import type { SovereignGovernanceContract } from '../types';
import {
  modelContinuitySharing,
  modelJointPublication,
  modelEscalationTransfer,
  modelCoalitionGovernance,
  snapshotContinuityResilience,
} from '../coordination';

const national: SovereignGovernanceContract = {
  federationId: 'national-coord',
  sovereigntyTier: 'national',
  sovereigntyMode: 'fully-autonomous',
  delegatedAuthorities: [
    'publication',
    'policy-enforcement',
    'member-governance',
    'ai-operations',
    'audit-visibility',
    'continuity-management',
  ],
  inheritedPolicies: [],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'national',
};

const local: SovereignGovernanceContract = {
  federationId: 'local-coord',
  sovereigntyTier: 'local',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: ['publication', 'member-governance', 'continuity-management'],
  inheritedPolicies: [],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'local',
};

const restrictedLocal: SovereignGovernanceContract = {
  ...local,
  federationId: 'local-restricted',
  sovereigntyMode: 'restricted',
  overrideRestrictions: ['publication'],
};

describe('coordination layer', () => {
  describe('modelContinuitySharing', () => {
    it('does not require approval when local has authority', () => {
      const event = modelContinuitySharing(local, national);
      expect(event.eventType).toBe('continuity-sharing-request');
      expect(event.requiresApproval).toBe(false);
    });

    it('requires approval when local is restricted', () => {
      const event = modelContinuitySharing(restrictedLocal, national);
      expect(event.requiresApproval).toBe(true);
    });

    it('escalation path goes from local to national', () => {
      const event = modelContinuitySharing(local, national);
      expect(event.escalationPath).toContain('local');
      expect(event.escalationPath).toContain('national');
    });
  });

  describe('modelJointPublication', () => {
    it('no approval needed when all participants have publication authority', () => {
      const event = modelJointPublication([national, local]);
      expect(event.requiresApproval).toBe(false);
    });

    it('requires approval when one participant is restricted', () => {
      const event = modelJointPublication([local, restrictedLocal]);
      expect(event.requiresApproval).toBe(true);
    });

    it('throws when no participants provided', () => {
      expect(() => modelJointPublication([])).toThrow();
    });
  });

  describe('modelEscalationTransfer', () => {
    it('produces escalation-transfer event', () => {
      const event = modelEscalationTransfer(local, 'national', 'policy-conflict');
      expect(event.eventType).toBe('escalation-transfer');
      expect(event.requiresApproval).toBe(true);
      expect(event.escalationPath).toContain('local');
      expect(event.escalationPath).toContain('national');
    });
  });

  describe('modelCoalitionGovernance', () => {
    it('models coalition event with 2+ participants', () => {
      const event = modelCoalitionGovernance([local, national]);
      expect(event.eventType).toBe('coalition-governance');
    });

    it('throws when fewer than 2 participants', () => {
      expect(() => modelCoalitionGovernance([local])).toThrow();
    });

    it('requires approval when any participant is restricted', () => {
      const event = modelCoalitionGovernance([local, restrictedLocal]);
      expect(event.requiresApproval).toBe(true);
    });
  });

  describe('snapshotContinuityResilience', () => {
    it('returns 100 score for empty contracts', () => {
      const snap = snapshotContinuityResilience([]);
      expect(snap.score).toBe(100);
    });

    it('counts continuity authority holders', () => {
      const snap = snapshotContinuityResilience([local, national]);
      expect(snap.sharingAgreementsActive).toBe(2);
    });

    it('detects gaps when no continuity authority', () => {
      const noAuth: SovereignGovernanceContract = {
        ...local,
        delegatedAuthorities: ['member-governance'],
        continuityRequirements: ['require.succession-plan'],
      };
      const snap = snapshotContinuityResilience([noAuth]);
      expect(snap.continuityGapsDetected).toBe(1);
    });
  });
});
