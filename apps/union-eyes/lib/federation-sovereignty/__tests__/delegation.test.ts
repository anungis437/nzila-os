import { describe, it, expect, beforeEach } from 'vitest';
import type { SovereignGovernanceContract, DelegationGrant } from '../types';
import {
  registerDelegationGrants,
  evaluateDelegationChain,
  evaluateAllDelegations,
  detectRevocableGrants,
  _resetDelegationRegistry,
} from '../delegation';

const baseContract: SovereignGovernanceContract = {
  federationId: 'local-del-001',
  sovereigntyTier: 'local',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: ['publication', 'member-governance'],
  inheritedPolicies: [],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'local',
};

const publicationGrant: DelegationGrant = {
  id: 'grant-001',
  grantingTier: 'regional',
  receivingFederationId: 'local-del-001',
  authority: 'publication',
  conditions: ['requires-approval-if-sensitive'],
  subDelegationAllowed: false,
  revocable: true,
};

describe('delegation engine', () => {
  beforeEach(() => {
    _resetDelegationRegistry();
  });

  describe('evaluateDelegationChain', () => {
    it('grants authority when in contract delegatedAuthorities', () => {
      const result = evaluateDelegationChain(baseContract, 'publication');
      expect(result.granted).toBe(true);
    });

    it('denies authority when not in delegatedAuthorities', () => {
      const result = evaluateDelegationChain(baseContract, 'ai-operations');
      expect(result.granted).toBe(false);
    });

    it('denies authority when in overrideRestrictions', () => {
      const c: SovereignGovernanceContract = {
        ...baseContract,
        overrideRestrictions: ['publication'],
      };
      const result = evaluateDelegationChain(c, 'publication');
      expect(result.granted).toBe(false);
    });

    it('includes registered grants in grant path', () => {
      registerDelegationGrants([publicationGrant]);
      const result = evaluateDelegationChain(baseContract, 'publication');
      expect(result.grantPath).toContain('regional');
    });

    it('includes grant conditions', () => {
      registerDelegationGrants([publicationGrant]);
      const result = evaluateDelegationChain(baseContract, 'publication');
      expect(result.conditions).toContain('requires-approval-if-sensitive');
    });

    it('flags sub-delegation conflict when not permitted', () => {
      registerDelegationGrants([publicationGrant]);
      const result = evaluateDelegationChain(baseContract, 'publication');
      expect(result.conflicts).toContain('sub-delegation.publication.not-permitted');
    });
  });

  describe('evaluateAllDelegations', () => {
    it('evaluates all 6 authorities', () => {
      const results = evaluateAllDelegations(baseContract);
      expect(results.size).toBe(6);
    });

    it('returns granted for delegated authorities', () => {
      const results = evaluateAllDelegations(baseContract);
      expect(results.get('publication')?.granted).toBe(true);
      expect(results.get('member-governance')?.granted).toBe(true);
    });

    it('returns not granted for undelegated authorities', () => {
      const results = evaluateAllDelegations(baseContract);
      expect(results.get('ai-operations')?.granted).toBe(false);
    });
  });

  describe('detectRevocableGrants', () => {
    it('returns empty when no grants registered', () => {
      const grants = detectRevocableGrants('local-del-001', 'publication');
      expect(grants).toHaveLength(0);
    });

    it('returns revocable grants', () => {
      registerDelegationGrants([publicationGrant]);
      const grants = detectRevocableGrants('local-del-001', 'publication');
      expect(grants).toHaveLength(1);
      expect(grants[0]?.revocable).toBe(true);
    });

    it('ignores non-revocable grants', () => {
      registerDelegationGrants([{ ...publicationGrant, revocable: false }]);
      const grants = detectRevocableGrants('local-del-001', 'publication');
      expect(grants).toHaveLength(0);
    });
  });
});
