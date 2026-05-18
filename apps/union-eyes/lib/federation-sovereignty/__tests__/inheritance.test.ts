import { describe, it, expect } from 'vitest';
import type { SovereignGovernanceContract } from '../types';
import {
  isSubordinateTier,
  resolvePolicyInheritance,
  resolvePublicationAuthority,
  resolveAIGovernanceCascade,
} from '../inheritance';

const nationalContract: SovereignGovernanceContract = {
  federationId: 'national-001',
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
  inheritedPolicies: ['policy.national-baseline', 'policy.ai-governance'],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'national',
};

const localContract: SovereignGovernanceContract = {
  federationId: 'local-inh-001',
  sovereigntyTier: 'local',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: ['publication', 'member-governance'],
  inheritedPolicies: ['policy.national-baseline'],
  overrideRestrictions: ['policy.ai-governance'],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'local',
};

describe('inheritance engine', () => {
  describe('isSubordinateTier', () => {
    it('local is subordinate to national', () => {
      expect(isSubordinateTier('local', 'national')).toBe(true);
    });

    it('regional is subordinate to national', () => {
      expect(isSubordinateTier('regional', 'national')).toBe(true);
    });

    it('national is NOT subordinate to local', () => {
      expect(isSubordinateTier('national', 'local')).toBe(false);
    });

    it('national is not subordinate to national', () => {
      expect(isSubordinateTier('national', 'national')).toBe(false);
    });

    it('affiliate is subordinate to national', () => {
      expect(isSubordinateTier('affiliate', 'national')).toBe(true);
    });
  });

  describe('resolvePolicyInheritance', () => {
    it('inherits non-restricted parent policies', () => {
      const result = resolvePolicyInheritance(
        localContract,
        nationalContract.inheritedPolicies,
      );
      expect(result.inheritedPolicies).toContain('policy.national-baseline');
    });

    it('excludes hard-locked (restricted) policies from inheritance', () => {
      const result = resolvePolicyInheritance(
        localContract,
        nationalContract.inheritedPolicies,
      );
      expect(result.inheritedPolicies).not.toContain('policy.ai-governance');
    });

    it('detects weakening attempts when policy-enforcement authority absent', () => {
      const result = resolvePolicyInheritance(
        localContract,
        nationalContract.inheritedPolicies,
        ['policy.national-baseline'],
      );
      expect(result.weakeningAttempted).toBe(true);
      expect(result.weakeningViolations).toContain('policy.national-baseline');
    });

    it('does not flag weakening when unit has policy-enforcement authority', () => {
      const c: SovereignGovernanceContract = {
        ...localContract,
        delegatedAuthorities: ['policy-enforcement', 'publication', 'member-governance'],
      };
      const result = resolvePolicyInheritance(
        c,
        nationalContract.inheritedPolicies,
        ['policy.national-baseline'],
      );
      expect(result.weakeningAttempted).toBe(false);
    });
  });

  describe('resolvePublicationAuthority', () => {
    it('grants publication when delegated and not restricted', () => {
      const result = resolvePublicationAuthority(localContract);
      expect(result.publicationAllowed).toBe(true);
      expect(result.requiresFederationApproval).toBe(false);
    });

    it('requires approval when publication authority not delegated', () => {
      const c: SovereignGovernanceContract = {
        ...localContract,
        delegatedAuthorities: ['member-governance'],
      };
      const result = resolvePublicationAuthority(c);
      expect(result.publicationAllowed).toBe(false);
      expect(result.requiresFederationApproval).toBe(true);
    });

    it('blocks publication when in overrideRestrictions', () => {
      const c: SovereignGovernanceContract = {
        ...localContract,
        overrideRestrictions: ['publication'],
      };
      const result = resolvePublicationAuthority(c);
      expect(result.publicationAllowed).toBe(false);
    });

    it('allows AI publication when both authorities present', () => {
      const c: SovereignGovernanceContract = {
        ...localContract,
        delegatedAuthorities: ['publication', 'member-governance', 'ai-operations'],
      };
      const result = resolvePublicationAuthority(c);
      expect(result.aiPublicationAllowed).toBe(true);
    });
  });

  describe('resolveAIGovernanceCascade', () => {
    it('cascades parent restrictions down', () => {
      const result = resolveAIGovernanceCascade(localContract, ['ai.parent-restriction']);
      expect(result.cascadedRestrictions).toContain('ai.parent-restriction');
    });

    it('adds ai.operations.restricted when AI is in overrideRestrictions', () => {
      const c: SovereignGovernanceContract = {
        ...localContract,
        overrideRestrictions: ['ai-operations'],
      };
      const result = resolveAIGovernanceCascade(c);
      expect(result.cascadedRestrictions).toContain('ai.operations.restricted');
    });

    it('allows local relaxation for fully-autonomous with AI authority', () => {
      const result = resolveAIGovernanceCascade(nationalContract);
      expect(result.localRelaxationAllowed).toBe(true);
    });
  });
});
