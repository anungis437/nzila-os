import { describe, it, expect } from 'vitest';
import type { SovereignGovernanceContract } from '../types';
import {
  detectPolicyDivergence,
  detectAuthorityOverride,
  detectPublicationDispute,
  detectAIAutonomyConflict,
  detectAuditVisibilityDisagreement,
  detectEscalationDeadlock,
} from '../conflicts';

const national: SovereignGovernanceContract = {
  federationId: 'national-conf',
  sovereigntyTier: 'national',
  sovereigntyMode: 'fully-autonomous',
  delegatedAuthorities: ['publication', 'policy-enforcement', 'ai-operations', 'member-governance', 'audit-visibility', 'continuity-management'],
  inheritedPolicies: ['policy.national-baseline', 'policy.ai-core'],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'national',
};

const local: SovereignGovernanceContract = {
  federationId: 'local-conf',
  sovereigntyTier: 'local',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: ['publication', 'member-governance'],
  inheritedPolicies: ['policy.national-baseline'],
  overrideRestrictions: ['policy.ai-core'],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'local',
};

describe('conflict resolver', () => {
  describe('detectPolicyDivergence', () => {
    it('detects divergence when child restricts parent policy', () => {
      const result = detectPolicyDivergence(national, local);
      expect(result.conflictDetected).toBe(true);
      expect(result.conflictType).toBe('policy-divergence');
    });

    it('no conflict when child does not restrict parent policies', () => {
      const c: SovereignGovernanceContract = { ...local, overrideRestrictions: [] };
      const result = detectPolicyDivergence(national, c);
      expect(result.conflictDetected).toBe(false);
    });

    it('auto-resolvable for federation-aligned mode', () => {
      const result = detectPolicyDivergence(national, local);
      expect(result.autoResolvable).toBe(true);
    });
  });

  describe('detectAuthorityOverride', () => {
    it('detects override attempt for restricted authority', () => {
      const c: SovereignGovernanceContract = {
        ...local,
        overrideRestrictions: ['publication'],
      };
      const result = detectAuthorityOverride(c, 'publication');
      expect(result.conflictDetected).toBe(true);
      expect(result.escalationRequired).toBe(true);
    });

    it('no conflict for non-restricted authority', () => {
      const result = detectAuthorityOverride(local, 'member-governance');
      expect(result.conflictDetected).toBe(false);
    });
  });

  describe('detectPublicationDispute', () => {
    it('detects dispute when one unit has authority and other is restricted', () => {
      const restricted: SovereignGovernanceContract = {
        ...local,
        overrideRestrictions: ['publication'],
      };
      const result = detectPublicationDispute(national, restricted);
      expect(result.conflictDetected).toBe(true);
    });

    it('no dispute when both have publication authority', () => {
      const result = detectPublicationDispute(national, local);
      expect(result.conflictDetected).toBe(false);
    });

    it('detects dispute when neither has authority', () => {
      const noAuth: SovereignGovernanceContract = {
        ...local,
        delegatedAuthorities: ['member-governance'],
      };
      const result = detectPublicationDispute(noAuth, noAuth);
      expect(result.conflictDetected).toBe(true);
    });
  });

  describe('detectAIAutonomyConflict', () => {
    it('detects conflict when AI authority not delegated', () => {
      const result = detectAIAutonomyConflict(local, 'ai.recommendation');
      expect(result.conflictDetected).toBe(true);
    });

    it('no conflict when AI authority delegated and not restricted', () => {
      const result = detectAIAutonomyConflict(national, 'ai.recommendation');
      expect(result.conflictDetected).toBe(false);
    });

    it('detects conflict for oversight-required mode', () => {
      const c: SovereignGovernanceContract = {
        ...national,
        sovereigntyMode: 'oversight-required',
      };
      const result = detectAIAutonomyConflict(c, 'ai.publication');
      expect(result.conflictDetected).toBe(true);
    });
  });

  describe('detectAuditVisibilityDisagreement', () => {
    it('detects disagreement when requested scope exceeds permitted', () => {
      const result = detectAuditVisibilityDisagreement(local, 'national');
      expect(result.conflictDetected).toBe(true);
    });

    it('no disagreement when requested scope within permitted', () => {
      const result = detectAuditVisibilityDisagreement(local, 'local');
      expect(result.conflictDetected).toBe(false);
    });

    it('national scope allows national request', () => {
      const result = detectAuditVisibilityDisagreement(national, 'national');
      expect(result.conflictDetected).toBe(false);
    });

    it('treats synthetic LIUNA central raw-detail requests beyond local visibility as a governance disagreement', () => {
      const liunaLocal: SovereignGovernanceContract = {
        ...local,
        federationId: 'liuna-local-900-synthetic',
        auditVisibility: 'regional',
      };

      const nationalRawRequest = detectAuditVisibilityDisagreement(liunaLocal, 'national');
      const federatedRawRequest = detectAuditVisibilityDisagreement(liunaLocal, 'federated');
      const opdcSummaryRequest = detectAuditVisibilityDisagreement(liunaLocal, 'regional');

      expect(nationalRawRequest.conflictDetected).toBe(true);
      expect(nationalRawRequest.conflictType).toBe('audit-visibility-disagreement');
      expect(nationalRawRequest.diagnostics).toMatchObject({
        permittedScope: 'regional',
        requestedScope: 'national',
      });
      expect(federatedRawRequest.conflictDetected).toBe(true);
      expect(opdcSummaryRequest.conflictDetected).toBe(false);
    });
  });

  describe('detectEscalationDeadlock', () => {
    it('detects deadlock when both tiers are national', () => {
      const result = detectEscalationDeadlock('national', 'national', 'policy-divergence');
      expect(result.conflictDetected).toBe(true);
      expect(result.resolutionPath).toBe('arbitration-required');
    });

    it('detects deadlock for same non-national tier with non-policy conflict', () => {
      const result = detectEscalationDeadlock('regional', 'regional', 'ai-autonomy-conflict');
      expect(result.conflictDetected).toBe(true);
    });

    it('no deadlock for different tiers', () => {
      const result = detectEscalationDeadlock('local', 'national', 'policy-divergence');
      expect(result.conflictDetected).toBe(false);
    });
  });
});
