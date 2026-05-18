import { describe, it, expect, beforeEach } from 'vitest';
import type { SovereignGovernanceContract } from '../types';
import {
  resolveEffectiveSovereigntyMode,
  resolveLocalEnforcementBoundary,
  resolveAIAutonomyBoundary,
  resolveAuditVisibilityPolicy,
} from '../autonomy';

const baseContract: SovereignGovernanceContract = {
  federationId: 'local-001',
  sovereigntyTier: 'local',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: [
    'publication',
    'policy-enforcement',
    'member-governance',
    'ai-operations',
    'audit-visibility',
    'continuity-management',
  ],
  inheritedPolicies: ['policy.baseline'],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'local',
};

describe('autonomy engine', () => {
  describe('resolveEffectiveSovereigntyMode', () => {
    it('returns oversight-required when parent forces it', () => {
      expect(resolveEffectiveSovereigntyMode(baseContract, true)).toBe('oversight-required');
    });

    it('returns restricted when override restrictions exceed half of authorities', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        overrideRestrictions: [
          'publication',
          'policy-enforcement',
          'member-governance',
          'ai-operations',
        ],
      };
      expect(resolveEffectiveSovereigntyMode(c)).toBe('restricted');
    });

    it('returns fully-autonomous when all authorities delegated and no escalation requirements', () => {
      expect(resolveEffectiveSovereigntyMode(baseContract)).toBe('fully-autonomous');
    });

    it('returns federation-aligned when escalation requirements present', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        escalationRequirements: ['publication'],
      };
      expect(resolveEffectiveSovereigntyMode(c)).toBe('federation-aligned');
    });

    it('returns federation-aligned when not all authorities are delegated', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        delegatedAuthorities: ['publication', 'member-governance'],
      };
      expect(resolveEffectiveSovereigntyMode(c)).toBe('federation-aligned');
    });
  });

  describe('resolveLocalEnforcementBoundary', () => {
    it('classifies all authorities as enforcable when fully-autonomous', () => {
      const boundary = resolveLocalEnforcementBoundary(baseContract);
      expect(boundary.enforcableAuthorities.length).toBeGreaterThan(0);
      expect(boundary.blockedAuthorities).toHaveLength(0);
    });

    it('blocks restricted authorities', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        overrideRestrictions: ['publication'],
      };
      const boundary = resolveLocalEnforcementBoundary(c);
      expect(boundary.blockedAuthorities).toContain('publication');
    });

    it('moves escalation-required authorities to federation-review', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        escalationRequirements: ['ai-operations'],
      };
      const boundary = resolveLocalEnforcementBoundary(c);
      expect(boundary.federationReviewRequired).toContain('ai-operations');
    });
  });

  describe('resolveAIAutonomyBoundary', () => {
    it('allows sensitive risk for fully-autonomous unit with AI authority', () => {
      const boundary = resolveAIAutonomyBoundary(baseContract);
      expect(boundary.maxPermittedRisk).toBe('sensitive');
      expect(boundary.localOverrideAllowed).toBe(true);
    });

    it('caps at advisory for federation-aligned', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        escalationRequirements: ['audit-visibility'],
      };
      const boundary = resolveAIAutonomyBoundary(c);
      expect(boundary.maxPermittedRisk).toBe('advisory');
    });

    it('caps at assistive when AI authority is not delegated', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        delegatedAuthorities: ['publication', 'member-governance'],
      };
      const boundary = resolveAIAutonomyBoundary(c);
      expect(boundary.maxPermittedRisk).toBe('assistive');
    });

    it('adds federated restrictions for oversight-required mode', () => {
      const boundary = resolveAIAutonomyBoundary({
        ...baseContract,
        sovereigntyMode: 'oversight-required',
      });
      expect(boundary.federatedRestrictions).toContain('ai.publication');
    });
  });

  describe('resolveAuditVisibilityPolicy', () => {
    it('local scope has only local detail visible', () => {
      const policy = resolveAuditVisibilityPolicy(baseContract);
      expect(policy.localDetailVisible).toBe(true);
      expect(policy.regionalSummaryVisible).toBe(false);
      expect(policy.federatedScopeAllowed).toBe(false);
    });

    it('federated scope allows all visibility', () => {
      const c = { ...baseContract, auditVisibility: 'federated' as const };
      const policy = resolveAuditVisibilityPolicy(c);
      expect(policy.federatedScopeAllowed).toBe(true);
      expect(policy.nationalEscalationsOnly).toBe(true);
    });
  });
});
