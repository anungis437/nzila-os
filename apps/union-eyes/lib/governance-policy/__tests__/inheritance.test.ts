import { describe, it, expect } from 'vitest';
import {
  resolveInheritedContracts,
  validateInheritanceStrength,
  isValidChildTier,
} from '../inheritance';
import type { FederationOrgNode } from '../inheritance';
import {
  CONTRACT_ROUTE_DEFAULT,
  CONTRACT_ROUTE_ADMIN,
  mergeContracts,
} from '../contracts';

// ── isValidChildTier ─────────────────────────────────────────────────────────

describe('isValidChildTier', () => {
  it('local is valid child of national', () => {
    expect(isValidChildTier('local', 'national')).toBe(true);
  });

  it('local is valid child of regional', () => {
    expect(isValidChildTier('local', 'regional')).toBe(true);
  });

  it('regional is valid child of national', () => {
    expect(isValidChildTier('regional', 'national')).toBe(true);
  });

  it('national is NOT valid child of regional', () => {
    expect(isValidChildTier('national', 'regional')).toBe(false);
  });

  it('standalone has no valid parent/child relationships', () => {
    expect(isValidChildTier('standalone', 'national')).toBe(false);
    expect(isValidChildTier('local', 'standalone')).toBe(false);
  });
});

// ── resolveInheritedContracts ─────────────────────────────────────────────────

describe('resolveInheritedContracts', () => {
  it('returns own contracts for standalone org', () => {
    const org: FederationOrgNode = {
      orgId: 'standalone-1',
      tier: 'standalone',
      ownContracts: [CONTRACT_ROUTE_DEFAULT],
      parent: null,
    };
    const resolved = resolveInheritedContracts(org);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.id).toBe('route.default');
  });

  it('inherits contracts from parent', () => {
    const national: FederationOrgNode = {
      orgId: 'national-1',
      tier: 'national',
      ownContracts: [CONTRACT_ROUTE_ADMIN],
      parent: null,
    };
    const local: FederationOrgNode = {
      orgId: 'local-1',
      tier: 'local',
      ownContracts: [],
      parent: national,
    };
    const resolved = resolveInheritedContracts(local);
    expect(resolved.map((c) => c.id)).toContain('route.admin');
  });

  it('most-restrictive-wins: child tightens sensitivity', () => {
    const national: FederationOrgNode = {
      orgId: 'national-1',
      tier: 'national',
      ownContracts: [CONTRACT_ROUTE_DEFAULT],
      parent: null,
    };

    const stricter = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      sensitivity: 'critical',
    });

    const local: FederationOrgNode = {
      orgId: 'local-1',
      tier: 'local',
      ownContracts: [stricter],
      parent: national,
    };

    const resolved = resolveInheritedContracts(local);
    const routeDefault = resolved.find((c) => c.id === 'route.default');
    expect(routeDefault?.sensitivity).toBe('critical');
  });

  it('most-restrictive-wins: enforce mode wins over shadow', () => {
    const national: FederationOrgNode = {
      orgId: 'national-1',
      tier: 'national',
      ownContracts: [CONTRACT_ROUTE_DEFAULT], // shadow
      parent: null,
    };

    const enforceLocal = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      mode: 'enforce',
    });

    const local: FederationOrgNode = {
      orgId: 'local-1',
      tier: 'local',
      ownContracts: [enforceLocal],
      parent: national,
    };

    const resolved = resolveInheritedContracts(local);
    const c = resolved.find((r) => r.id === 'route.default');
    expect(c?.mode).toBe('enforce');
  });

  it('multi-level inheritance chains correctly', () => {
    const national: FederationOrgNode = {
      orgId: 'nat',
      tier: 'national',
      ownContracts: [CONTRACT_ROUTE_DEFAULT],
      parent: null,
    };
    const regional: FederationOrgNode = {
      orgId: 'reg',
      tier: 'regional',
      ownContracts: [],
      parent: national,
    };
    const local: FederationOrgNode = {
      orgId: 'loc',
      tier: 'local',
      ownContracts: [],
      parent: regional,
    };
    const resolved = resolveInheritedContracts(local);
    expect(resolved.some((c) => c.id === 'route.default')).toBe(true);
  });
});

// ── validateInheritanceStrength ───────────────────────────────────────────────

describe('validateInheritanceStrength', () => {
  it('passes when child is identical to parent', () => {
    const violations = validateInheritanceStrength(
      CONTRACT_ROUTE_DEFAULT,
      CONTRACT_ROUTE_DEFAULT,
    );
    expect(violations).toHaveLength(0);
  });

  it('detects sensitivity weakening', () => {
    const weakened = mergeContracts(CONTRACT_ROUTE_ADMIN, {
      sensitivity: 'low',
    });
    const violations = validateInheritanceStrength(CONTRACT_ROUTE_ADMIN, weakened);
    expect(violations.some((v) => v.includes('sensitivity weakened'))).toBe(true);
  });

  it('detects mode weakening (enforce → shadow)', () => {
    const enforcedParent = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      mode: 'enforce',
    });
    const shadowChild = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      mode: 'shadow',
    });
    const violations = validateInheritanceStrength(enforcedParent, shadowChild);
    expect(violations.some((v) => v.includes('mode weakened'))).toBe(true);
  });

  it('detects removed requirements', () => {
    const parentWithRetention = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      requirements: ['retention-lock'],
    });
    const violations = validateInheritanceStrength(
      parentWithRetention,
      CONTRACT_ROUTE_DEFAULT,
    );
    expect(violations.some((v) => v.includes('requirement removed'))).toBe(true);
  });

  it('detects org-scoping weakening', () => {
    const violations = validateInheritanceStrength(
      CONTRACT_ROUTE_ADMIN, // strict
      mergeContracts(CONTRACT_ROUTE_ADMIN, { orgScoping: 'standard' }),
    );
    expect(violations.some((v) => v.includes('orgScoping weakened'))).toBe(true);
  });

  it('allows child to add requirements (strengthening is valid)', () => {
    const strengthened = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      requirements: ['legal-review'],
    });
    const violations = validateInheritanceStrength(
      CONTRACT_ROUTE_DEFAULT,
      strengthened,
    );
    expect(violations).toHaveLength(0);
  });
});
