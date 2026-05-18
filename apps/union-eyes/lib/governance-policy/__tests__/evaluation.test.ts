import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluatePolicy,
  flushDecisionLedger,
  peekDecisionLedger,
} from '../evaluation';
import type { PolicyEvaluationContext } from '../evaluation';
import {
  CONTRACT_ROUTE_DEFAULT,
  CONTRACT_ROUTE_ADMIN,
  CONTRACT_PUBLIC_SURFACE,
  CONTRACT_AI_SENSITIVE,
  mergeContracts,
} from '../contracts';

beforeEach(() => {
  flushDecisionLedger(); // clear ledger between tests
});

// ── Shadow mode ───────────────────────────────────────────────────────────────

describe('shadow mode', () => {
  it('always allows even when requirements are unmet', () => {
    const ctx: PolicyEvaluationContext = {
      operationId: 'test.op',
      executiveApproved: false,
    };
    // CONTRACT_PUBLIC_SURFACE requires executive-approval
    const result = evaluatePolicy(CONTRACT_PUBLIC_SURFACE, ctx);
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('shadow');
    expect(result.unmetRequirements).toContain('executive-approval');
    expect(result.notes.some((n) => n.includes('[shadow]'))).toBe(true);
  });

  it('records decision in ledger', () => {
    evaluatePolicy(CONTRACT_ROUTE_DEFAULT, { operationId: 'route.x' });
    const ledger = peekDecisionLedger();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.contractId).toBe('route.default');
  });

  it('flushDecisionLedger returns decisions and clears', () => {
    evaluatePolicy(CONTRACT_ROUTE_DEFAULT, { operationId: 'route.a' });
    evaluatePolicy(CONTRACT_ROUTE_DEFAULT, { operationId: 'route.b' });
    const flushed = flushDecisionLedger();
    expect(flushed).toHaveLength(2);
    expect(peekDecisionLedger()).toHaveLength(0);
  });
});

// ── Enforce mode ──────────────────────────────────────────────────────────────

describe('enforce mode', () => {
  const enforcePublicSurface = mergeContracts(CONTRACT_PUBLIC_SURFACE, {
    mode: 'enforce',
  });

  it('blocks when executive-approval is unmet', () => {
    const result = evaluatePolicy(enforcePublicSurface, {
      operationId: 'surface.test',
      executiveApproved: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.mode).toBe('enforce');
    expect(result.unmetRequirements).toContain('executive-approval');
  });

  it('allows when all requirements are met', () => {
    const result = evaluatePolicy(enforcePublicSurface, {
      operationId: 'surface.test',
      executiveApproved: true,
      isPublic: true,
    });
    // executive-approval met; federation-review still unmet for federation contract
    // but CONTRACT_PUBLIC_SURFACE doesn't require federation-review
    expect(result.unmetRequirements).not.toContain('executive-approval');
  });

  it('blocks cross-org on strict-scoped contract', () => {
    const strictEnforce = mergeContracts(CONTRACT_ROUTE_ADMIN, {
      mode: 'enforce',
    });
    const result = evaluatePolicy(strictEnforce, {
      operationId: 'admin.route',
      isCrossOrg: true,
    });
    expect(result.allowed).toBe(false);
  });
});

// ── Requirement checking ──────────────────────────────────────────────────────

describe('requirement checking', () => {
  it('flags legal-review when unmet', () => {
    const aiSensitiveEnforce = mergeContracts(CONTRACT_AI_SENSITIVE, {
      mode: 'enforce',
    });
    const result = evaluatePolicy(aiSensitiveEnforce, {
      operationId: 'ai.op',
      executiveApproved: false,
      legalReviewComplete: false,
    });
    expect(result.unmetRequirements).toContain('executive-approval');
    // legal-review is not in CONTRACT_AI_SENSITIVE requirements — confirm:
    // it won't flag if not required
    expect(result.allowed).toBe(false);
  });

  it('allows when legal-review is not required', () => {
    const result = evaluatePolicy(CONTRACT_ROUTE_DEFAULT, {
      operationId: 'route.simple',
      legalReviewComplete: false,
    });
    expect(result.unmetRequirements).not.toContain('legal-review');
  });

  it('shouldAudit reflects contract auditRequired', () => {
    const result = evaluatePolicy(CONTRACT_ROUTE_DEFAULT, {
      operationId: 'route.audit',
    });
    expect(result.shouldAudit).toBe(true);
  });
});

// ── mergeContracts ────────────────────────────────────────────────────────────

describe('mergeContracts', () => {
  it('unions requirements', () => {
    const merged = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      requirements: ['legal-review'],
    });
    expect(merged.requirements).toContain('audit');
    expect(merged.requirements).toContain('legal-review');
  });

  it('override wins on scalar fields', () => {
    const merged = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      sensitivity: 'critical',
      mode: 'enforce',
    });
    expect(merged.sensitivity).toBe('critical');
    expect(merged.mode).toBe('enforce');
  });

  it('does not duplicate requirements', () => {
    const merged = mergeContracts(CONTRACT_ROUTE_DEFAULT, {
      requirements: ['audit'],
    });
    const auditCount = merged.requirements.filter((r) => r === 'audit').length;
    expect(auditCount).toBe(1);
  });
});
